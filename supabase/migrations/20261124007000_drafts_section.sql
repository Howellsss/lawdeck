-- Lawdeck migration 70: a "Drafts and precedents (all courses)" library section (founder, 2026-11-24:
-- "one more option for drafts asides the Law school courses").
-- 1. courses.shared marks a library section that is not a Law School course: students never see it
--    as a course (course lists and hubs leave it out), but its approved material is searched with
--    every course's questions. It goes through review like everything else.
-- 2. search_library (migration 37) also returns approved passages from shared sections. Otherwise
--    unchanged.
-- Needs migrations 1–69.

alter table public.courses add column shared boolean not null default false;

insert into public.courses (slug, name, position, shared)
values ('drafts-and-precedents', 'Drafts and precedents (all courses)', 99, true)
on conflict (slug) do nothing;

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
    -- Shared sections (migration 70: drafts and precedents) are searched with every course.
    where (course is null or i.course_id = course
           or i.course_id in (select s.id from public.courses s where s.shared))
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
  select p.id, a.id, public.kb_source_label(i, p.heading),
         case when public.kb_source_is_public(i.source_kind) then p.heading end,
         p.text,
         case when public.kb_source_is_public(i.source_kind) then p.page_from end,
         case when public.kb_source_is_public(i.source_kind) then p.page_to end,
         f.score::double precision, f.meaning_rank, f.words_rank
  from fused f
  join public.kb_passages p on p.id = f.id
  join allowed a on a.id = p.item_id
  join public.kb_items i on i.id = p.item_id
  order by f.score desc, p.id
  limit least(greatest(coalesce(match_count, 8), 1), 30);
end;
$$;
revoke execute on function public.search_library(text, uuid, extensions.vector, text, integer, boolean)
  from public, anon;
grant execute on function public.search_library(text, uuid, extensions.vector, text, integer, boolean)
  to authenticated, service_role;
