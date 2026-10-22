-- Lawdeck migration 19: marking guides hold their exam-style question (Phase 4, step 4d).
-- One guide = one exam-style question with its marking points (founder, 2026-10-22). Reviewers
-- write and approve them on /admin/rubrics; only approved guides are ever used to mark students.

alter table public.rubrics
  add column question text check (char_length(question) between 10 and 6000);

-- A guide can only be approved once it has its question and at least one marking point.
alter table public.rubrics
  add constraint rubrics_complete_when_approved
  check (status <> 'approved' or (question is not null and jsonb_array_length(criteria) > 0));

grant insert (question), update (question) on public.rubrics to authenticated;

-- The database records who approved or withdrew a guide and when (never trusted from the browser).
-- Changing an approved guide's wording or points puts it back to draft ("pending"), so nothing
-- unchecked is ever used for marking. Replaces the migration 17 trigger function.
create or replace function public.rubrics_reviewed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  elsif old.status = 'approved'
    and (new.question is distinct from old.question
         or new.criteria is distinct from old.criteria
         or new.title is distinct from old.title
         or new.topic_id is distinct from old.topic_id) then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;
