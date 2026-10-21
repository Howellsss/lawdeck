-- Migration 11: closing Phase 2.
-- 1. Material that needs re-checking after a change in the law leaves student search at once,
--    and comes back when a reviewer confirms a new "law current as of" date (KB-02).
-- 2. A separate store keeps every original library file, which nobody can overwrite or delete,
--    so the library can be rebuilt from scratch (Q-03).

-- ---------------------------------------------------------------------------
-- 1. search_library, as in migration 10, with one change: for students, approved items that a
--    later law change has made out of date (kb_items_needing_recheck, migration 9) are left out.
--    Reviewers and the marked admin jobs still find them, so they can check them.
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
    where i.course_id = course
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
-- 2. The archive of original files (Q-03). Private. Admins may add and read files; there is no
--    rule that lets anyone overwrite or delete them. Each file is stored under its own content
--    fingerprint, so a changed file is a new version and never replaces the old one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-archive',
  'library-archive',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do nothing;

create policy "Admins add archived library files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'library-archive' and public.is_admin());

create policy "Admins read archived library files" on storage.objects
  for select to authenticated
  using (bucket_id = 'library-archive' and public.is_admin());

-- Where an item's original is archived. Written once, by the reading step; never changed after.
alter table public.kb_items add column archive_path text;

create function public.kb_items_archive_path_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archive_path is distinct from old.archive_path then
    if old.archive_path is not null then
      raise exception 'The archived copy of a library file cannot be changed.' using errcode = '23514';
    end if;
    -- Only admins (who run the reading step) or the marked admin jobs may record it.
    if (select auth.uid()) is not null and not public.is_admin() then
      raise exception 'Only admins can record the archived copy.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger kb_items_archive_path_once
  before update of archive_path on public.kb_items
  for each row execute function public.kb_items_archive_path_once();
