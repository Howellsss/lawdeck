-- Migration 10: room for the re-ranker, and a search limit per student.
-- The re-ranker (Voyage rerank-2.5, src/server/retrieval/rerank.ts) needs the top 30 candidates
-- to pick the best 8 from (retrieval test: 35/35, docs/specs/retrieval-eval.md). So a search
-- may now return up to 30 passages to the server. The screen and the AI still get at most 8.
-- To keep the library hard to copy out, students get a search limit: 40 an hour, 200 a day.
-- Reviewers, admins and the marked admin jobs (service key) are not limited.

-- ---------------------------------------------------------------------------
-- search_events: one row per student search, for the limit. No question text is stored.
create table public.search_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index search_events_owner_time on public.search_events (owner_id, created_at desc);

alter table public.search_events enable row level security;
-- People may see their own searches (for a future "searches left" note); nobody writes directly.
create policy search_events_select_own on public.search_events
  for select to authenticated using (owner_id = (select auth.uid()));
revoke insert, update, delete on public.search_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- search_library, as in migration 7, with two changes: up to 30 results, and the limit.
-- It now writes a row (search_events), so it is volatile instead of stable.
create or replace function public.search_library(
  query_text text,
  course uuid,
  query_embedding extensions.vector(1024) default null,
  model text default null,
  match_count integer default 8,
  include_pending boolean default false
)
returns table (
  passage_id uuid,
  item_id uuid,
  item_title text,
  heading text,
  text text,
  page_from integer,
  page_to integer,
  score double precision,
  meaning_rank integer,
  words_rank integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
  is_job boolean := current_setting('role', true) = 'service_role';
begin
  -- Signed-in people, or the marked admin jobs (service key) such as the retrieval test.
  if me is null and not is_job then
    raise exception 'Sign in to search.' using errcode = '42501';
  end if;
  if include_pending and not public.is_reviewer() and not is_job then
    raise exception 'Only reviewers can search material awaiting review.' using errcode = '42501';
  end if;
  if query_text is null or char_length(query_text) > 2000 then
    raise exception 'The question must be 2000 characters or fewer.' using errcode = '22023';
  end if;

  -- The search limit, for students only (is_reviewer() is true for reviewers and admins).
  if not is_job and not public.is_reviewer() then
    if (select count(*) from public.search_events e
         where e.owner_id = me and e.created_at > now() - interval '1 hour') >= 40
       or (select count(*) from public.search_events e
         where e.owner_id = me and e.created_at > now() - interval '1 day') >= 200 then
      raise exception 'Search limit reached. Please try again later.' using errcode = 'LD429';
    end if;
    delete from public.search_events e where e.owner_id = me and e.created_at < now() - interval '2 days';
    insert into public.search_events (owner_id) values (me);
  end if;

  return query
  with allowed as (
    select i.id, i.title
    from public.kb_items i
    where i.course_id = course
      and (i.review_status = 'approved' or (include_pending and i.review_status = 'pending'))
  ),
  by_meaning as (
    select p.id, (row_number() over (order by p.embedding operator(extensions.<=>) query_embedding))::integer as rank
    from public.kb_passages p
    join allowed a on a.id = p.item_id
    where query_embedding is not null and p.embedding is not null and p.embedding_model = model
    order by p.embedding operator(extensions.<=>) query_embedding
    limit 40
  ),
  by_words as (
    select p.id,
           (row_number() over (
             order by ts_rank_cd(p.search_text, websearch_to_tsquery('english', query_text)) desc
           ))::integer as rank
    from public.kb_passages p
    join allowed a on a.id = p.item_id
    where p.search_text @@ websearch_to_tsquery('english', query_text)
    order by ts_rank_cd(p.search_text, websearch_to_tsquery('english', query_text)) desc
    limit 40
  ),
  fused as (
    select coalesce(m.id, w.id) as id,
           coalesce(1.0 / (60 + m.rank), 0) + coalesce(1.0 / (60 + w.rank), 0) as score,
           m.rank as meaning_rank,
           w.rank as words_rank
    from by_meaning m
    full join by_words w on w.id = m.id
  )
  select p.id, a.id, a.title, p.heading, p.text, p.page_from, p.page_to,
         f.score::double precision, f.meaning_rank, f.words_rank
  from fused f
  join public.kb_passages p on p.id = f.id
  join allowed a on a.id = p.item_id
  order by f.score desc, p.id
  limit least(greatest(coalesce(match_count, 8), 1), 30);
end;
$$;

revoke execute on function public.search_library(text, uuid, extensions.vector, text, integer, boolean)
  from public, anon;
grant execute on function public.search_library(text, uuid, extensions.vector, text, integer, boolean)
  to authenticated, service_role;
