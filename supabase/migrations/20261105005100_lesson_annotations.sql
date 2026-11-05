-- Lawdeck migration 51: students' own marks and notes in Topic Lessons (Remembrance Phase 3a;
-- founder's brief, section 30: select text, highlight, circle, underline, add notes, remove, saved
-- automatically). Each student's own. One look for every student mark (founder, 2026-11-05:
-- option B), always distinguishable from Lawdeck's highlights.
-- A mark remembers where it was (section, paragraph, characters) and the words themselves, so it
-- can be found again when a lesson is updated; if the words are gone it is listed as a note from
-- an earlier version, never lost.

create table public.lesson_annotations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  lesson_id uuid references public.topic_lessons (id) on delete set null,
  section integer not null check (section between 0 and 199),
  paragraph integer not null check (paragraph between 0 and 199),
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null,
  quote text not null check (char_length(quote) between 1 and 500),
  style text not null check (style in ('highlight', 'circle', 'underline')),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_annotations_range check (end_offset > start_offset and end_offset - start_offset <= 500)
);
alter table public.lesson_annotations enable row level security;
create index lesson_annotations_owner_topic_idx on public.lesson_annotations (owner_id, topic_id);
create trigger lesson_annotations_set_updated_at
  before update on public.lesson_annotations
  for each row execute function public.set_updated_at();

-- Only on a lesson the student can read (row-level security on topic_lessons decides), and at most
-- 3,000 marks per student.
create function public.lesson_annotations_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.lesson_annotations where owner_id = new.owner_id) >= 3000 then
    raise exception 'You have made 3,000 marks. Remove some to add more.' using errcode = '23514';
  end if;
  if new.lesson_id is not null and not exists (
    select 1 from public.topic_lessons l where l.id = new.lesson_id and l.topic_id = new.topic_id) then
    raise exception 'That lesson could not be found.' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke execute on function public.lesson_annotations_check() from public, anon, authenticated;
create trigger lesson_annotations_check
  before insert or update on public.lesson_annotations
  for each row execute function public.lesson_annotations_check();

create policy "Students read their marks" on public.lesson_annotations
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Students add marks" on public.lesson_annotations
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Students change their marks" on public.lesson_annotations
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Students remove their marks" on public.lesson_annotations
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.lesson_annotations from anon, authenticated;
grant select, delete on public.lesson_annotations to authenticated;
grant insert (topic_id, lesson_id, section, paragraph, start_offset, end_offset, quote, style, note) on public.lesson_annotations to authenticated;
grant update (lesson_id, section, paragraph, start_offset, end_offset, style, note) on public.lesson_annotations to authenticated;
