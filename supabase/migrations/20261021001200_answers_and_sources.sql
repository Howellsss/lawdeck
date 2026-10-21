-- Lawdeck migration 12: answers and their sources (Phase 3, steps 3a and 3b).
-- System Design §3 (message_sources) and §4; PRD LN-01, LN-03, WS-04.
-- 1. search_library also searches every course when no course is chosen ("All courses").
-- 2. message_sources: which library passages each answer relied on (for the Sources panel).
-- 3. source_passage: a student opens one source of their own answer, only while the
--    material is still approved and not out of date.

-- ---------------------------------------------------------------------------
-- 1. search_library, as in migration 11, with one change: course may be null (all courses).
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
  is_staff boolean := public.is_reviewer();
begin
  if me is null and not is_job then
    raise exception 'Sign in to search.' using errcode = '42501';
  end if;
  if include_pending and not is_staff and not is_job then
    raise exception 'Only reviewers can search material awaiting review.' using errcode = '42501';
  end if;
  if query_text is null or char_length(query_text) > 2000 then
    raise exception 'The question must be 2000 characters or fewer.' using errcode = '22023';
  end if;

  -- The search limit, for students only (migration 10).
  if not is_job and not is_staff then
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
    where (course is null or i.course_id = course)
      and (i.review_status = 'approved' or (include_pending and i.review_status = 'pending'))
      -- Out of date after a later law change: students never get it until it is re-checked.
      and (is_staff or is_job or not exists (
        select 1 from public.law_changes c
        where c.course_id = i.course_id
          and (i.law_current_as_of is null or c.effective_on > i.law_current_as_of)
      ))
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

-- ---------------------------------------------------------------------------
-- 2. message_sources. A source belongs to an answer in the student's own chat.
alter table public.messages add constraint messages_id_owner_key unique (id, owner_id);

create table public.message_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The number the answer cites it by: [S1], [S2], ...
  label integer not null check (label between 1 and 30),
  -- The passage itself stays in the library; if it is removed, the source shows as unavailable.
  kb_passage_id uuid references public.kb_passages (id) on delete set null,
  -- What the source list shows without opening the passage.
  item_title text not null check (char_length(item_title) between 1 and 300),
  heading text check (char_length(heading) <= 500),
  page_from integer check (page_from >= 1),
  page_to integer check (page_to >= page_from),
  created_at timestamptz not null default now(),
  unique (message_id, label),
  foreign key (message_id, owner_id) references public.messages (id, owner_id) on delete cascade
);
alter table public.message_sources enable row level security;
create index message_sources_message_idx on public.message_sources (message_id);

-- Owners read and add sources to their own answers. Never edited; removed with the message.
revoke all on public.message_sources from anon, authenticated;
grant select on public.message_sources to authenticated;
grant insert (message_id, label, kb_passage_id, item_title, heading, page_from, page_to)
  on public.message_sources to authenticated;
create policy "Owners read their sources" on public.message_sources
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners add sources to their answers" on public.message_sources
  for insert to authenticated with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. source_passage: the wording of one source, for its owner only, and only while the item
-- is approved and not hidden by a later change in the law (the same rule as search).
create function public.source_passage(source uuid)
returns table (
  item_title text,
  heading text,
  text text,
  page_from integer,
  page_to integer,
  available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.item_title,
         s.heading,
         case when ok.passage_id is not null then p.text end,
         s.page_from,
         s.page_to,
         ok.passage_id is not null
  from public.message_sources s
  left join public.kb_passages p on p.id = s.kb_passage_id
  left join lateral (
    select p.id as passage_id
    from public.kb_items i
    where i.id = p.item_id
      and i.review_status = 'approved'
      and not exists (
        select 1 from public.law_changes c
        where c.course_id = i.course_id
          and (i.law_current_as_of is null or c.effective_on > i.law_current_as_of)
      )
  ) ok on true
  where s.id = source
    and s.owner_id = (select auth.uid());
$$;

revoke execute on function public.source_passage(uuid) from public, anon;
grant execute on function public.source_passage(uuid) to authenticated;
