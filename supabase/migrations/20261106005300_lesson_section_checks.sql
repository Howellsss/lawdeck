-- Lawdeck migration 53: skim, tick and approve (founder approved 2026-11-06; replaces the reminder
-- in CLAUDE.md). A reviewer reads a lesson section by section and ticks each one "checked", or
-- marks it "problem" with a note. Ticks belong to one version of the lesson: when its text changes
-- the version goes up and the lesson must be read again. Approving as "read in full" needs every
-- section ticked (checked by the server; docs/specs/remembrance.md).
-- Reviewers' working records: only reviewers (and admins) read or write them; students never do.

create table public.lesson_section_checks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.topic_lessons (id) on delete cascade,
  lesson_version integer not null check (lesson_version >= 1),
  section integer not null check (section between 0 and 99),
  verdict text not null check (verdict in ('checked', 'problem')),
  note text check (char_length(note) <= 2000),
  -- A problem always says what is wrong.
  constraint lesson_section_checks_problem_note check (verdict <> 'problem' or char_length(coalesce(note, '')) >= 3),
  checked_by uuid default auth.uid() references auth.users (id) on delete set null,
  checked_at timestamptz not null default now(),
  unique (lesson_id, lesson_version, section)
);
alter table public.lesson_section_checks enable row level security;

create policy "Reviewers read section checks" on public.lesson_section_checks
  for select to authenticated using (public.is_reviewer());
create policy "Reviewers tick sections" on public.lesson_section_checks
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers change section ticks" on public.lesson_section_checks
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Reviewers clear section ticks" on public.lesson_section_checks
  for delete to authenticated using (public.is_reviewer());

revoke all on public.lesson_section_checks from anon, authenticated;
grant select, delete on public.lesson_section_checks to authenticated;
grant insert (lesson_id, lesson_version, section, verdict, note),
  update (verdict, note, checked_at)
  on public.lesson_section_checks to authenticated;

-- Who ticked is always the reviewer doing it, and the time is the database's.
create or replace function public.lesson_section_checks_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.checked_by := (select auth.uid());
  new.checked_at := now();
  return new;
end;
$$;
revoke execute on function public.lesson_section_checks_stamp() from public, anon, authenticated;
create trigger lesson_section_checks_stamp
  before insert or update on public.lesson_section_checks
  for each row execute function public.lesson_section_checks_stamp();
