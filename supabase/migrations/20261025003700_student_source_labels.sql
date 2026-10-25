-- Lawdeck migration 37: student-facing source labels, admin source tracing and source rights
-- (founder, 2026-10-25). Students never see a lecturer's name, a private file name, a Drive link
-- or the page numbers of privately attributed notes; administrators still see everything.
-- 1. kb_items gains source_kind (official, publication, lecturer_note, unattributed, pending),
--    an optional student-facing title and topic, and a rights status and note. The original
--    title, file name and Drive source are never changed: the student label is derived from them.
--    New and existing items get a first guess from their title, file name and type; staff correct
--    it on the library page.
-- 2. kb_source_label(): the label students see. Official documents and publications keep their
--    real title (and their pages); lecturer notes, unattributed and unclassified material show
--    "Course — Topic", or "Study Material — Pending Identification" when no topic is known.
-- 3. kb_passage_labels(): the labels for a set of search results, used before anything reaches
--    the model or the screen.
-- 4. Saved answers, briefs, practice and marking keep the label, not the original title: existing
--    rows are relabelled, and relabelling an item later updates its saved answer sources.
-- 5. source_passage() shows the label and, except for statutes and rules of court, a short extract
--    (50 words at most, as CLAUDE.md requires), with the course to study it in.
-- 6. Students read only official and published items directly; lecturer notes and unclassified
--    items stay behind the functions above.
-- 7. admin_answer_sources() and admin_item_usage(): every original source and passage behind an
--    answer, and every answer that relied on an item. Admins only.
-- 8. Marking an item's rights "restricted" withdraws it from students at once (search, sources).
-- 9. search_library() returns the student label too, so no caller ever receives a file's own title.

-- ---------------------------------------------------------------------------
-- 1. Columns.
create type public.source_kind as enum ('official', 'publication', 'lecturer_note', 'unattributed', 'pending');
create type public.source_rights as enum ('unknown', 'permitted', 'restricted');

alter table public.kb_items
  add column source_kind public.source_kind not null default 'pending',
  add column display_title text check (char_length(btrim(display_title)) between 1 and 300),
  add column display_topic text check (char_length(btrim(display_topic)) between 1 and 160),
  add column rights_status public.source_rights not null default 'unknown',
  add column rights_note text check (char_length(rights_note) <= 2000);

-- Signs that a document is someone's own notes: "X's notes", "notes by", "lecture", "handout",
-- the S.A notes and drafts, a title such as "Dr." or "Barr.", or initials and a surname.
create function public.kb_looks_personal(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(t, '') ~* '(''s notes|\mnotes? (on|by)\M|\mlecture|\mhandout|\ms\.\s?a\.?\s+(note|draft)|\m(mr|mrs|ms|dr|prof|barr|hon)\.?\s)'
      or coalesce(t, '') ~ '\m[A-Z]\.\s?[A-Z]\.\s+[A-Z][a-z]+';
$$;

-- A first guess at what kind of source an item is. Never "official" or "publication" for
-- anything that looks like personal notes.
create function public.kb_guess_source_kind(title text, file_name text, item_type public.kb_item_type)
returns public.source_kind
language sql
immutable
set search_path = ''
as $$
  select case
    when public.kb_looks_personal(title) or public.kb_looks_personal(file_name) then 'lecturer_note'::public.source_kind
    when item_type in ('statute', 'rule_of_court', 'case') then 'official'
    when coalesce(title, '') ~* '(constitution|rules of professional conduct|practice directions?|\mact\M|\mrules\M|regulations|\mlaws? of\M)' then 'official'
    when coalesce(title, '') ~* '(handbook|textbook|law reports?|journal)' then 'publication'
    else 'pending'
  end;
$$;

update public.kb_items set source_kind = public.kb_guess_source_kind(title, file_name, type);

-- New items get the guess too (unless staff set a kind when adding them).
create function public.kb_items_guess_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_kind = 'pending' then
    new.source_kind := public.kb_guess_source_kind(new.title, new.file_name, new.type);
  end if;
  return new;
end;
$$;
create trigger kb_items_guess_kind
  before insert on public.kb_items
  for each row execute function public.kb_items_guess_kind();

-- ---------------------------------------------------------------------------
-- 2. The student label.
-- An all-capitals title or heading in ordinary title case ("REVIEW CIVIL LITIGATION HANDBOOK
-- 2025" becomes "Review Civil Litigation Handbook 2025"); anything else is kept as written.
create function public.kb_tidy(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when t is null or btrim(t) = '' then null
    when t = upper(t) and t ~ '[A-Z]' then
      replace(replace(replace(replace(replace(replace(replace(
        initcap(btrim(t)), ' Of ', ' of '), ' And ', ' and '), ' The ', ' the '), ' For ', ' for '),
        ' In ', ' in '), ' On ', ' on '), ' To ', ' to ')
    else btrim(t)
  end;
$$;

create function public.kb_source_is_public(kind public.source_kind)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select kind in ('official', 'publication');
$$;

create function public.kb_source_label(i public.kb_items, heading text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when public.kb_source_is_public(i.source_kind) then
      left(coalesce(nullif(btrim(i.display_title), ''), public.kb_tidy(i.title)), 300)
    else left(
      coalesce(
        (select c.name from public.courses c where c.id = i.course_id) || ' — ' ||
        coalesce(
          nullif(btrim(i.display_topic), ''),
          -- A heading that names the author or repeats the file's title is not used as a topic.
          case when heading is not null and not public.kb_looks_personal(heading)
                    and lower(btrim(heading)) <> lower(btrim(i.title))
               then left(public.kb_tidy(heading), 120) end,
          (select t.name from public.topics t where t.id = any (i.topic_ids) order by t.position limit 1)
        ),
        'Study Material — Pending Identification'
      ), 300)
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Labels for search results: approved items only (any item for staff and marked jobs).
create function public.kb_passage_labels(passages uuid[])
returns table (
  passage_id uuid,
  label text,
  heading text,
  show_pages boolean,
  source_kind public.source_kind,
  course_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         public.kb_source_label(i, p.heading),
         case when public.kb_source_is_public(i.source_kind) then p.heading end,
         public.kb_source_is_public(i.source_kind),
         i.source_kind,
         c.slug
  from public.kb_passages p
  join public.kb_items i on i.id = p.item_id
  join public.courses c on c.id = i.course_id
  where p.id = any (passages)
    and ((select auth.uid()) is not null or current_setting('role', true) = 'service_role')
    and (i.review_status = 'approved' or public.is_reviewer() or current_setting('role', true) = 'service_role');
$$;
revoke execute on function public.kb_passage_labels(uuid[]) from public, anon;
grant execute on function public.kb_passage_labels(uuid[]) to authenticated, service_role;

-- The helpers run only inside the functions above.
revoke execute on function public.kb_looks_personal(text), public.kb_guess_source_kind(text, text, public.kb_item_type),
  public.kb_tidy(text), public.kb_source_is_public(public.source_kind), public.kb_source_label(public.kb_items, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Saved labels: answers (message_sources), briefs, practice and marking feedback.
create function public.kb_relabel_sources(item uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.message_sources s
     set item_title = public.kb_source_label(i, p.heading),
         heading = case when public.kb_source_is_public(i.source_kind) then p.heading end,
         page_from = case when public.kb_source_is_public(i.source_kind) then p.page_from end,
         page_to = case when public.kb_source_is_public(i.source_kind) then p.page_to end
    from public.kb_passages p
    join public.kb_items i on i.id = p.item_id
   where s.kb_passage_id = p.id
     and (item is null or i.id = item);
$$;
revoke execute on function public.kb_relabel_sources(uuid) from public, anon, authenticated;

select public.kb_relabel_sources(null);

-- Briefs, practice questions and marking feedback stored the title in a list of
-- {label, title, heading, pages}; each entry whose title is a library item's is relabelled.
create function public.kb_relabel_list(list jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
           case when i.id is null then e
                else e || jsonb_build_object(
                  'title', public.kb_source_label(i, e ->> 'heading'),
                  'heading', case when public.kb_source_is_public(i.source_kind) then e -> 'heading' else 'null'::jsonb end,
                  'pages', case when public.kb_source_is_public(i.source_kind) then e -> 'pages' else 'null'::jsonb end)
           end order by n), '[]'::jsonb)
  from jsonb_array_elements(list) with ordinality as x(e, n)
  left join lateral (
    select k.* from public.kb_items k where k.title = e ->> 'title' order by k.created_at limit 1
  ) i on true;
$$;
revoke execute on function public.kb_relabel_list(jsonb) from public, anon, authenticated;

update public.briefs set sources = public.kb_relabel_list(sources) where jsonb_array_length(sources) > 0;
update public.practice_items set sources = public.kb_relabel_list(sources) where jsonb_array_length(sources) > 0;
update public.attempts set feedback = jsonb_set(feedback, '{sources}', public.kb_relabel_list(feedback -> 'sources'))
 where jsonb_typeof(feedback -> 'sources') = 'array';

-- Changing how an item is presented updates its saved answer sources; rights marked
-- "restricted" withdraw the item from students at once.
create function public.kb_items_after_label_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.kb_relabel_sources(new.id);
  return null;
end;
$$;
create trigger kb_items_relabel
  after update of source_kind, display_title, display_topic, title, course_id, topic_ids on public.kb_items
  for each row execute function public.kb_items_after_label_change();

create function public.kb_items_rights_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rights_status = 'restricted' and new.review_status = 'approved' then
    new.review_status := 'withdrawn';
  end if;
  return new;
end;
$$;
create trigger kb_items_rights_guard
  before insert or update of rights_status, review_status on public.kb_items
  for each row execute function public.kb_items_rights_guard();

-- ---------------------------------------------------------------------------
-- 5. Opening a source. Its return columns change, so it is replaced.
drop function public.source_passage(uuid);
create function public.source_passage(source uuid)
returns table (
  item_title text,
  heading text,
  text text,
  page_from integer,
  page_to integer,
  available boolean,
  full_text boolean,
  course_slug text,
  course_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select case when s.origin = 'library' and i.id is not null then public.kb_source_label(i, p.heading) else s.item_title end,
         case when s.origin = 'library' then
                case when i.id is not null and public.kb_source_is_public(i.source_kind) then p.heading end
              else s.heading end,
         case when ok.passage_id is not null then
                case when i.type in ('statute', 'rule_of_court') then p.text
                     else (select array_to_string((w.words)[1:50], ' ') ||
                                  case when cardinality(w.words) > 50 then ' …' else '' end
                             from (select regexp_split_to_array(btrim(p.text), '\s+') as words) w) end
              when s.origin = 'upload' then up.text end,
         case when s.origin = 'upload' or public.kb_source_is_public(i.source_kind) then s.page_from end,
         case when s.origin = 'upload' or public.kb_source_is_public(i.source_kind) then s.page_to end,
         case when s.origin = 'upload' then up.id is not null else ok.passage_id is not null end,
         s.origin = 'upload' or i.type in ('statute', 'rule_of_court'),
         c.slug,
         c.name
  from public.message_sources s
  left join public.kb_passages p on p.id = s.kb_passage_id
  left join public.kb_items i on i.id = p.item_id
  left join public.courses c on c.id = i.course_id
  left join public.upload_passages up on up.id = s.upload_passage_id and up.owner_id = s.owner_id
  left join lateral (
    select p.id as passage_id
    where i.review_status = 'approved'
      and not exists (
        select 1 from public.law_changes lc
        where lc.course_id = i.course_id
          and (i.law_current_as_of is null or lc.effective_on > i.law_current_as_of)
      )
  ) ok on true
  -- $1, not "source": kb_items has a column of that name.
  where s.id = $1
    and s.owner_id = (select auth.uid());
$$;
revoke execute on function public.source_passage(uuid) from public, anon;
grant execute on function public.source_passage(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Direct reads: students see only official and published items; staff see everything.
drop policy "Students see approved items; reviewers see all" on public.kb_items;
create policy "Students see approved official items; reviewers see all" on public.kb_items
  for select to authenticated
  using (public.is_reviewer() or (review_status = 'approved' and source_kind in ('official', 'publication')));

-- ---------------------------------------------------------------------------
-- 7. Tracing, for admins.
create function public.admin_answer_sources(answer uuid)
returns table (
  label integer,
  origin text,
  student_label text,
  item_id uuid,
  original_title text,
  file_name text,
  drive_source text,
  source_kind public.source_kind,
  rights_status public.source_rights,
  review_status public.review_status,
  passage_heading text,
  page_from integer,
  page_to integer,
  passage_text text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  return query
    select s.label, s.origin::text, s.item_title, i.id, i.title, i.file_name, i.source,
           i.source_kind, i.rights_status, i.review_status, p.heading, p.page_from, p.page_to, p.text
      from public.message_sources s
      left join public.kb_passages p on p.id = s.kb_passage_id
      left join public.kb_items i on i.id = p.item_id
     where s.message_id = answer and s.origin = 'library'
     order by s.label;
end;
$$;
revoke execute on function public.admin_answer_sources(uuid) from public, anon;
grant execute on function public.admin_answer_sources(uuid) to authenticated;

create function public.admin_item_usage(item uuid)
returns table (answers integer, students integer, last_used timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  return query
    select count(distinct s.message_id)::integer, count(distinct s.owner_id)::integer, max(s.created_at)
      from public.message_sources s
      join public.kb_passages p on p.id = s.kb_passage_id
     where p.item_id = item;
end;
$$;
revoke execute on function public.admin_item_usage(uuid) from public, anon;
grant execute on function public.admin_item_usage(uuid) to authenticated;

-- The answers that relied on an item, newest first (for a withdrawn or challenged source).
create function public.admin_item_answers(item uuid)
returns table (message_id uuid, used_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  return query
    select s.message_id, max(s.created_at)
      from public.message_sources s
      join public.kb_passages p on p.id = s.kb_passage_id
     where p.item_id = item
     group by s.message_id
     order by max(s.created_at) desc
     limit 200;
end;
$$;
revoke execute on function public.admin_item_answers(uuid) from public, anon;
grant execute on function public.admin_item_answers(uuid) to authenticated;

-- Trigger functions only run when rows change (migration 33).
revoke execute on function public.kb_items_guess_kind(), public.kb_items_after_label_change(),
  public.kb_items_rights_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Search returns the student label, never the file's own title, and pages only for official
-- documents and publications (the same rule as above). Otherwise unchanged from migration 12.
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
