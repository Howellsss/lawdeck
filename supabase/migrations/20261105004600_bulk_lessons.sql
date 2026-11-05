-- Lawdeck migration 46: approving a whole course's lessons at once (founder's decision,
-- 2026-11-05; docs/specs/remembrance.md). Lessons approved this way are marked, students see a
-- note that a reviewer has not yet read them in full, and students can report a mistake in one.

-- 1. Which approvals were for a whole course. Any other decision clears the mark; approving one
-- lesson on its own page sets it back to false (read in full).
alter table public.topic_lessons add column bulk_approved boolean not null default false;
grant update (bulk_approved) on public.topic_lessons to authenticated;

create or replace function public.topic_lessons_reviewed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content is distinct from old.content then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  if new.status is distinct from old.status then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  elsif old.status = 'approved'
    and (new.content is distinct from old.content or new.title is distinct from old.title) then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  if new.status <> 'approved' then
    new.bulk_approved := false;
  end if;
  return new;
end;
$$;
revoke execute on function public.topic_lessons_reviewed() from public, anon, authenticated;

-- Changing a question or authority card of an approved lesson sends it back to review, unmarked.
create or replace function public.lesson_part_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.topic_lessons
     set status = 'pending', reviewed_by = null, reviewed_at = null, bulk_approved = false
   where id = coalesce(new.lesson_id, old.lesson_id) and status = 'approved';
  return coalesce(new, old);
end;
$$;
revoke execute on function public.lesson_part_changed() from public, anon, authenticated;

-- 2. Students can report a problem in a lesson they can read.
alter table public.problem_reports drop constraint problem_reports_target_kind_check;
alter table public.problem_reports add constraint problem_reports_target_kind_check
  check (target_kind in ('answer', 'document', 'brief', 'practice_item', 'lesson'));

create or replace function public.problem_reports_check_target()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  found boolean := false;
begin
  if (select count(*) from public.problem_reports
       where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 50 then
    raise exception 'You have sent a lot of reports today. Please try again tomorrow.' using errcode = '23514';
  end if;
  if new.target_kind = 'answer' then
    found := exists (select 1 from public.messages m where m.id = new.target_id and m.owner_id = new.owner_id and m.role = 'assistant');
  elsif new.target_kind = 'document' then
    found := exists (select 1 from public.documents d where d.id = new.target_id and d.owner_id = new.owner_id);
  elsif new.target_kind = 'brief' then
    found := exists (select 1 from public.briefs b where b.id = new.target_id and b.owner_id = new.owner_id);
  elsif new.target_kind = 'practice_item' then
    found := exists (select 1 from public.practice_items p where p.id = new.target_id and p.owner_id = new.owner_id);
  elsif new.target_kind = 'lesson' then
    -- Shared, not owned: row-level security shows the student only lessons they may read.
    found := exists (select 1 from public.topic_lessons l where l.id = new.target_id);
  end if;
  if not found then
    raise exception 'That could not be found.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function public.problem_report_context(report uuid)
returns table (title text, body text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.problem_reports;
begin
  if not public.is_reviewer() then
    return;
  end if;
  select * into r from public.problem_reports where id = report;
  if r.id is null then
    return;
  end if;
  return query
  select x.title, left(x.body, 4000)
  from (
    select c.title, coalesce(m.content ->> 'text', '') as body
      from public.messages m join public.conversations c on c.id = m.conversation_id
     where r.target_kind = 'answer' and m.id = r.target_id
    union all
    select d.title, coalesce(t.title, '') from public.documents d left join public.templates t on t.id = d.template_id
     where r.target_kind = 'document' and d.id = r.target_id
    union all
    select b.name, b.sections::text from public.briefs b
     where r.target_kind = 'brief' and b.id = r.target_id
    union all
    select p.question, p.answer from public.practice_items p
     where r.target_kind = 'practice_item' and p.id = r.target_id
    union all
    select 'Lesson: ' || l.title, '/admin/lessons/' || l.topic_id::text from public.topic_lessons l
     where r.target_kind = 'lesson' and l.id = r.target_id
  ) x
  limit 1;
end;
$$;
revoke all on function public.problem_report_context(uuid) from public, anon;
grant execute on function public.problem_report_context(uuid) to authenticated;
