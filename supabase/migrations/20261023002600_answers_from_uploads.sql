-- Lawdeck migration 26: answers that use the student's own uploads (Phase 6, step 6c).
-- PRD UP-02 and UP-03; Engineering Rules G-07. Approved by the founder, 2026-10-23.
-- 1. search_uploads(): the signed-in student's own Ready upload passages, ranked by meaning and
--    by words like the library search. Nobody else's passages can ever be returned.
-- 2. message_sources can point at an upload passage (only the owner's own), with its origin, so
--    answers show "From your uploads" or "From the Lawdeck library".
-- 3. source_passage() opens an upload source for its owner only; a deleted upload shows as no
--    longer available.
-- 4. conversations.use_uploads: the per-chat "Use my uploads" switch (on unless turned off).

-- ---------------------------------------------------------------------------
-- 1. Searching the student's own uploads.
create function public.search_uploads(
  query_text text,
  query_embedding extensions.vector(1024) default null,
  model text default null,
  match_count integer default 10
)
returns table (
  passage_id uuid,
  upload_id uuid,
  file_name text,
  heading text,
  text text,
  page_from integer,
  page_to integer,
  score double precision,
  meaning_rank integer,
  words_rank integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in to search.' using errcode = '42501';
  end if;
  if query_text is null or char_length(query_text) > 2000 then
    raise exception 'The question must be 2000 characters or fewer.' using errcode = '22023';
  end if;

  return query
  with mine as (
    select u.id, u.file_name
    from public.uploads u
    where u.owner_id = me and u.status = 'ready'
  ),
  by_meaning as (
    select p.id, (row_number() over (order by p.embedding operator(extensions.<=>) query_embedding))::integer as rank
    from public.upload_passages p
    join mine m on m.id = p.upload_id
    where p.owner_id = me and query_embedding is not null and p.embedding is not null and p.embedding_model = model
    order by p.embedding operator(extensions.<=>) query_embedding
    limit 30
  ),
  by_words as (
    select p.id,
           (row_number() over (
             order by ts_rank_cd(p.search_text, websearch_to_tsquery('english', query_text)) desc
           ))::integer as rank
    from public.upload_passages p
    join mine m on m.id = p.upload_id
    where p.owner_id = me and p.search_text @@ websearch_to_tsquery('english', query_text)
    order by ts_rank_cd(p.search_text, websearch_to_tsquery('english', query_text)) desc
    limit 30
  ),
  fused as (
    select coalesce(bm.id, bw.id) as id,
           coalesce(1.0 / (60 + bm.rank), 0) + coalesce(1.0 / (60 + bw.rank), 0) as score,
           bm.rank as meaning_rank,
           bw.rank as words_rank
    from by_meaning bm
    full join by_words bw on bw.id = bm.id
  )
  select p.id, m.id, m.file_name, p.heading, p.text, p.page_from, p.page_to,
         f.score::double precision, f.meaning_rank, f.words_rank
  from fused f
  join public.upload_passages p on p.id = f.id and p.owner_id = me
  join mine m on m.id = p.upload_id
  order by f.score desc, p.id
  limit least(greatest(coalesce(match_count, 10), 1), 20);
end;
$$;
revoke execute on function public.search_uploads(text, extensions.vector, text, integer) from public, anon;
grant execute on function public.search_uploads(text, extensions.vector, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Sources from uploads.
alter table public.upload_passages add constraint upload_passages_id_owner_key unique (id, owner_id);

alter table public.message_sources
  add column origin text not null default 'library' check (origin in ('library', 'upload')),
  add column upload_passage_id uuid,
  -- An upload source can only point at the student's own passage; it is cleared if deleted.
  add constraint message_sources_upload_passage_fkey
    foreign key (upload_passage_id, owner_id) references public.upload_passages (id, owner_id)
    on delete set null (upload_passage_id),
  -- A source points at a passage of its own origin only (either may be cleared later).
  add constraint message_sources_origin_matches check (
    (origin = 'library' and upload_passage_id is null) or (origin = 'upload' and kb_passage_id is null)
  );

grant insert (origin, upload_passage_id) on public.message_sources to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Opening a source: library passages as before (approved and up to date); upload passages
-- for their owner only, while the upload still exists.
create or replace function public.source_passage(source uuid)
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
         case when ok.passage_id is not null then p.text
              when s.origin = 'upload' then up.text end,
         s.page_from,
         s.page_to,
         case when s.origin = 'upload' then up.id is not null else ok.passage_id is not null end
  from public.message_sources s
  left join public.kb_passages p on p.id = s.kb_passage_id
  left join public.upload_passages up on up.id = s.upload_passage_id and up.owner_id = s.owner_id
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

-- ---------------------------------------------------------------------------
-- 4. The "Use my uploads" switch, per chat.
alter table public.conversations add column use_uploads boolean not null default true;
grant insert (use_uploads), update (use_uploads) on public.conversations to authenticated;
