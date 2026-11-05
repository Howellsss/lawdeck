-- Lawdeck migration 47: memory aids and stories, Remembrance Phase 2 (founder's brief,
-- 2026-11-05; docs/specs/remembrance.md). Shared and reviewed, one set per lesson, written by
-- Lawdeck from the lesson and the library passages it rests on. Kept beside the lesson, not inside
-- it, so adding them never sends an approved lesson back to review.
--   lesson_extras        one per lesson: its review state (like the lesson's own)
--   lesson_memory_aids   acronyms, memory phrases, word associations and groupings
--   lesson_stories       everyday stories (labelled illustrations) and case stories

create table public.lesson_extras (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.topic_lessons (id) on delete cascade,
  status public.review_status not null default 'pending',
  bulk_approved boolean not null default false,
  model text check (char_length(model) <= 80),
  prompt_version text check (char_length(prompt_version) <= 40),
  review_note text check (char_length(review_note) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lesson_extras enable row level security;
create trigger lesson_extras_set_updated_at
  before update on public.lesson_extras
  for each row execute function public.set_updated_at();

create table public.lesson_memory_aids (
  id uuid primary key default gen_random_uuid(),
  extras_id uuid not null references public.lesson_extras (id) on delete cascade,
  position integer not null check (position between 0 and 49),
  -- The section it helps with: shown just after it.
  after_section integer not null check (after_section between 0 and 199),
  kind text not null check (kind in ('acronym', 'phrase', 'association', 'pattern')),
  -- What it helps the student remember, e.g. "The elements of a valid contract".
  title text not null check (char_length(title) between 2 and 200),
  -- The acronym, the memory phrase, the association, or the grouping's name.
  device text not null check (char_length(device) between 1 and 300),
  -- What each letter, word or group stands for: [{ "key": "C", "meaning": "Consensus" }, ...].
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 20),
  explanation text check (char_length(explanation) <= 1500),
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array')
);
alter table public.lesson_memory_aids enable row level security;
create index lesson_memory_aids_extras_idx on public.lesson_memory_aids (extras_id, position);

create table public.lesson_stories (
  id uuid primary key default gen_random_uuid(),
  extras_id uuid not null references public.lesson_extras (id) on delete cascade,
  position integer not null check (position between 0 and 49),
  after_section integer not null check (after_section between 0 and 199),
  -- 'everyday': a made-up Nigerian situation, always labelled an illustration.
  -- 'case': a reported case told as a story, from what the library says about it.
  kind text not null check (kind in ('everyday', 'case')),
  title text not null check (char_length(title) between 2 and 200),
  -- The lesson's authority card it tells (case stories) or introduces (everyday stories).
  authority_key text check (char_length(authority_key) <= 60),
  -- The story in parts: [{ "heading": "What happened", "text": "..." }, ...].
  parts jsonb not null check (jsonb_typeof(parts) = 'array' and jsonb_array_length(parts) between 1 and 12),
  takeaway text not null check (char_length(takeaway) between 1 and 400),
  -- One quick question to check the point landed (optional).
  question text check (char_length(question) <= 600),
  choices jsonb check (choices is null or (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 6)),
  correct_choice integer,
  explanation text check (char_length(explanation) <= 1500),
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  constraint lesson_stories_case_names_authority check (kind <> 'case' or authority_key is not null),
  constraint lesson_stories_question_complete check (
    (question is null and choices is null and correct_choice is null)
    or (question is not null and choices is not null and correct_choice between 0 and jsonb_array_length(choices) - 1))
);
alter table public.lesson_stories enable row level security;
create index lesson_stories_extras_idx on public.lesson_stories (extras_id, position);

-- ---------------------------------------------------------------------------
-- Who reads them: reviewers always; students only when both the lesson and its memory aids are
-- approved and they have access (the same rule as lessons).
create function public.lesson_extras_readable(extras uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_reviewer() or exists (
    select 1 from public.lesson_extras e
      join public.topic_lessons l on l.id = e.lesson_id
     where e.id = extras and e.status = 'approved' and l.status = 'approved' and public.has_pilot_access());
$$;
revoke execute on function public.lesson_extras_readable(uuid) from public, anon;
grant execute on function public.lesson_extras_readable(uuid) to authenticated;

create policy "Students read approved memory aids; reviewers read all" on public.lesson_extras
  for select to authenticated using (public.lesson_extras_readable(id));
create policy "Reviewers add memory aids" on public.lesson_extras
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers decide on memory aids" on public.lesson_extras
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Reviewers remove memory aids" on public.lesson_extras
  for delete to authenticated using (public.is_reviewer());

create policy "Students read approved aids; reviewers read all" on public.lesson_memory_aids
  for select to authenticated using (public.lesson_extras_readable(extras_id));
create policy "Reviewers write aids" on public.lesson_memory_aids
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers remove aids" on public.lesson_memory_aids
  for delete to authenticated using (public.is_reviewer());

create policy "Students read approved stories; reviewers read all" on public.lesson_stories
  for select to authenticated using (public.lesson_extras_readable(extras_id));
create policy "Reviewers write stories" on public.lesson_stories
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers remove stories" on public.lesson_stories
  for delete to authenticated using (public.is_reviewer());

-- ---------------------------------------------------------------------------
-- Review, recorded by the database. Any decision but approval clears the "approved with its
-- course" mark.
create function public.lesson_extras_reviewed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;
  if new.status <> 'approved' then
    new.bulk_approved := false;
  end if;
  return new;
end;
$$;
revoke execute on function public.lesson_extras_reviewed() from public, anon, authenticated;
create trigger lesson_extras_reviewed
  before update on public.lesson_extras
  for each row execute function public.lesson_extras_reviewed();

-- Removing or adding an aid or story sends the set back to review.
create function public.lesson_extras_part_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lesson_extras
     set status = 'pending', reviewed_by = null, reviewed_at = null, bulk_approved = false
   where id = coalesce(new.extras_id, old.extras_id) and status = 'approved';
  return coalesce(new, old);
end;
$$;
revoke execute on function public.lesson_extras_part_changed() from public, anon, authenticated;
create trigger lesson_memory_aids_changed
  after insert or delete on public.lesson_memory_aids
  for each row execute function public.lesson_extras_part_changed();
create trigger lesson_stories_changed
  after insert or delete on public.lesson_stories
  for each row execute function public.lesson_extras_part_changed();

-- When a lesson's wording changes (edited or rewritten), its memory aids go back to review too:
-- they may no longer match it.
create function public.lesson_content_changed_extras()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.content is distinct from old.content then
    update public.lesson_extras
       set status = 'pending', reviewed_by = null, reviewed_at = null, bulk_approved = false
     where lesson_id = new.id and status = 'approved';
  end if;
  return new;
end;
$$;
revoke execute on function public.lesson_content_changed_extras() from public, anon, authenticated;
create trigger topic_lessons_content_changed_extras
  after update on public.topic_lessons
  for each row execute function public.lesson_content_changed_extras();

-- ---------------------------------------------------------------------------
-- Columns. Visitors get nothing; who reviewed, and when, is set by the database.
revoke all on public.lesson_extras, public.lesson_memory_aids, public.lesson_stories from anon, authenticated;
grant select on public.lesson_extras, public.lesson_memory_aids, public.lesson_stories to authenticated;
grant insert (lesson_id, model, prompt_version),
  update (status, bulk_approved, review_note, model, prompt_version),
  delete on public.lesson_extras to authenticated;
grant insert (extras_id, position, after_section, kind, title, device, items, explanation, sources),
  delete on public.lesson_memory_aids to authenticated;
grant insert (extras_id, position, after_section, kind, title, authority_key, parts, takeaway, question, choices, correct_choice, explanation, sources),
  delete on public.lesson_stories to authenticated;
