-- Lawdeck migration 7: searching the library (Phase 2, step 2d).
-- System Design §6: hybrid search (meaning + exact words), filtered by course and approval
-- in the database before ranking. Students never read passages directly; they get a few
-- approved passages at a time through search_library.

-- How many of an item's passages have search vectors, and from which model.
-- Written by the marked admin job (service key); admins could change them, reviewers cannot.
alter table public.kb_items
  add column indexed_passages integer not null default 0 check (indexed_passages >= 0),
  add column index_model text check (char_length(index_model) <= 80),
  add column indexed_at timestamptz;

create or replace function public.kb_items_review_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- auth.uid() is empty only for marked admin jobs (service key), which may change anything.
  if (select auth.uid()) is not null and not public.is_admin() then
    if (new.title, new.type, new.course_id, new.topic_ids, new.campus, new.year, new.source,
        new.storage_path, new.file_name, new.mime_type, new.size_bytes, new.created_by,
        new.reading_status, new.reading_method, new.reading_quality, new.page_count, new.read_at,
        new.reading_error, new.indexed_passages, new.index_model, new.indexed_at)
       is distinct from
       (old.title, old.type, old.course_id, old.topic_ids, old.campus, old.year, old.source,
        old.storage_path, old.file_name, old.mime_type, old.size_bytes, old.created_by,
        old.reading_status, old.reading_method, old.reading_quality, old.page_count, old.read_at,
        old.reading_error, old.indexed_passages, old.index_model, old.indexed_at) then
      raise exception 'Reviewers can only change review details.' using errcode = '42501';
    end if;
  end if;
  if new.review_status is distinct from old.review_status then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

-- New passages have no search vectors yet, so replacing passages also clears the index count.
create or replace function public.replace_kb_passages(
  target_item uuid,
  passages jsonb,
  method public.reading_method,
  quality numeric,
  pages integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  added integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can replace passages.' using errcode = '42501';
  end if;
  if jsonb_typeof(passages) is distinct from 'array' or jsonb_array_length(passages) > 5000 then
    raise exception 'Passages must be a list of at most 5000.' using errcode = '22023';
  end if;

  delete from public.kb_passages where item_id = target_item;
  insert into public.kb_passages (item_id, position, heading, text, page_from, page_to)
  select target_item,
         (p.ordinality - 1)::integer,
         nullif(p.value ->> 'heading', ''),
         p.value ->> 'text',
         (p.value ->> 'pageFrom')::integer,
         (p.value ->> 'pageTo')::integer
  from jsonb_array_elements(passages) with ordinality as p;
  get diagnostics added = row_count;

  update public.kb_items
     set reading_status = 'done', reading_method = method, reading_quality = quality,
         page_count = pages, read_at = now(), reading_error = null,
         indexed_passages = 0, index_model = null, indexed_at = null
   where id = target_item;
  if not found then
    raise exception 'That item no longer exists.' using errcode = 'P0002';
  end if;
  return added;
end;
$$;

-- ---------------------------------------------------------------------------
-- search_library: the one way to search the library.
-- Each question is ranked two ways, by meaning (search vectors from the given model) and by
-- exact words; the two rankings are combined (reciprocal rank fusion, k = 60). Filters come
-- first: course and approval status. At most 8 passages come back, so the library cannot be
-- copied out. Reviewers (only) may include material awaiting review, to test before approving.
create function public.search_library(
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
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Signed-in people, or the marked admin jobs (service key) such as the retrieval test.
  if (select auth.uid()) is null and current_setting('role', true) is distinct from 'service_role' then
    raise exception 'Sign in to search.' using errcode = '42501';
  end if;
  if include_pending and not public.is_reviewer()
     and current_setting('role', true) is distinct from 'service_role' then
    raise exception 'Only reviewers can search material awaiting review.' using errcode = '42501';
  end if;
  if query_text is null or char_length(query_text) > 2000 then
    raise exception 'The question must be 2000 characters or fewer.' using errcode = '22023';
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
  limit least(greatest(coalesce(match_count, 8), 1), 8);
end;
$$;

revoke execute on function public.search_library(text, uuid, extensions.vector, text, integer, boolean)
  from public, anon;
grant execute on function public.search_library(text, uuid, extensions.vector, text, integer, boolean)
  to authenticated, service_role;
