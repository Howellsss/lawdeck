-- Lawdeck migration 45: the remembrance and retention system, Phase 1 (founder's brief,
-- 2026-11-05; docs/specs/remembrance.md). One set of records shared by every feature, so the
-- Study Diary, recall while reading and "Before you move on" never keep separate copies.
--
-- Shared and reviewed (one per topic; students see it only once a reviewer approves it, rule H-05):
--   topic_lessons      the lesson students read, written by Lawdeck from the library
--   lesson_checkpoints the recall questions placed inside it
--   lesson_authorities the cases and statutes it teaches, each traceable to library passages
-- Each student's own (owner only, rule S-03):
--   study_sessions     one per student, topic and day (Lagos), so revisiting never duplicates
--   recall_attempts    every answer: while reading, in the topic test, or in revision
--   review_items       when each checkpoint is next due for revision
--   diary_notes        the student's own notes on a topic

-- ---------------------------------------------------------------------------
-- 1. Lessons (shared, reviewed).
create table public.topic_lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null unique references public.topics (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  -- The lesson's sections, with the marked phrases (case, principle, statute, exam tip,
  -- exception, definition) and the library passages each section rests on. Checked by the
  -- app's schema before it is saved.
  content jsonb not null default '{}' check (jsonb_typeof(content) = 'object'),
  -- Goes up by one each time the content changes, so a session records which version it read.
  version integer not null default 1 check (version >= 1),
  status public.review_status not null default 'pending',
  model text check (char_length(model) <= 80),
  prompt_version text check (char_length(prompt_version) <= 40),
  review_note text check (char_length(review_note) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topic_lessons_complete_when_approved check (status <> 'approved' or content <> '{}')
);
alter table public.topic_lessons enable row level security;
create trigger topic_lessons_set_updated_at
  before update on public.topic_lessons
  for each row execute function public.set_updated_at();

-- Same rule as templates: a changed approved lesson goes back to review, and the reviewer and
-- time are recorded by the database, not the app.
create function public.topic_lessons_reviewed()
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
  return new;
end;
$$;
revoke execute on function public.topic_lessons_reviewed() from public, anon, authenticated;
create trigger topic_lessons_reviewed
  before update on public.topic_lessons
  for each row execute function public.topic_lessons_reviewed();

create table public.lesson_checkpoints (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.topic_lessons (id) on delete cascade,
  position integer not null check (position between 0 and 199),
  -- The section the question comes after: students are only asked about what they have read.
  after_section integer not null check (after_section between 0 and 199),
  -- 'reading' questions sit inside the lesson; 'test' questions make up the end-of-topic test.
  placement text not null check (placement in ('reading', 'test')),
  kind text not null check (kind in ('mcq', 'short', 'open', 'authority', 'statute', 'principle', 'sequence')),
  prompt text not null check (char_length(prompt) between 3 and 2000),
  choices jsonb check (choices is null or (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 6)),
  correct_choice integer check (correct_choice between 0 and 5),
  answer text not null check (char_length(answer) between 1 and 4000),
  explanation text check (char_length(explanation) <= 4000),
  -- The point being tested, in a few words ("counter-offer rejects the offer"), for the diary's
  -- "what I need to revisit".
  key_point text not null check (char_length(key_point) between 2 and 200),
  -- Library passage ids it rests on (never their text).
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  unique (lesson_id, position),
  constraint lesson_checkpoints_mcq check (
    (kind = 'mcq') = (choices is not null and correct_choice is not null)
    and (correct_choice is null or correct_choice < jsonb_array_length(choices)))
);
alter table public.lesson_checkpoints enable row level security;
create index lesson_checkpoints_lesson_idx on public.lesson_checkpoints (lesson_id);

create table public.lesson_authorities (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.topic_lessons (id) on delete cascade,
  -- How the lesson's marked phrases point to this authority.
  key text not null check (key ~ '^[a-z0-9-]{1,60}$'),
  kind text not null check (kind in ('case', 'statute')),
  name text not null check (char_length(name) between 2 and 300),
  citation text check (char_length(citation) <= 300),
  court text check (char_length(court) <= 200),
  facts text check (char_length(facts) <= 4000),
  issue text check (char_length(issue) <= 2000),
  decision text check (char_length(decision) <= 2000),
  principle text not null check (char_length(principle) between 2 and 2000),
  -- False when the library gives the principle but not the facts: the card then says the facts
  -- need verifying instead of filling them in (founder's brief, section 8B).
  facts_from_library boolean not null default false,
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  unique (lesson_id, key)
);
alter table public.lesson_authorities enable row level security;
create index lesson_authorities_lesson_idx on public.lesson_authorities (lesson_id);

-- Whether a student may read this lesson: it is approved and they have access to Lawdeck.
create function public.lesson_is_readable(lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_reviewer() or exists (
    select 1 from public.topic_lessons l
     where l.id = lesson and l.status = 'approved' and public.has_pilot_access());
$$;
revoke execute on function public.lesson_is_readable(uuid) from public, anon;
grant execute on function public.lesson_is_readable(uuid) to authenticated;

create policy "Students read approved lessons; reviewers read all" on public.topic_lessons
  for select to authenticated using (public.lesson_is_readable(id));
create policy "Reviewers write lessons" on public.topic_lessons
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers change lessons" on public.topic_lessons
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Admins remove lessons" on public.topic_lessons
  for delete to authenticated using (public.is_admin());

create policy "Students read approved checkpoints; reviewers read all" on public.lesson_checkpoints
  for select to authenticated using (public.lesson_is_readable(lesson_id));
create policy "Reviewers write checkpoints" on public.lesson_checkpoints
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers change checkpoints" on public.lesson_checkpoints
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Reviewers remove checkpoints" on public.lesson_checkpoints
  for delete to authenticated using (public.is_reviewer());

create policy "Students read approved authorities; reviewers read all" on public.lesson_authorities
  for select to authenticated using (public.lesson_is_readable(lesson_id));
create policy "Reviewers write authorities" on public.lesson_authorities
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers change authorities" on public.lesson_authorities
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Reviewers remove authorities" on public.lesson_authorities
  for delete to authenticated using (public.is_reviewer());

-- Changing a checkpoint or authority of an approved lesson sends the lesson back to review.
create function public.lesson_part_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.topic_lessons
     set status = 'pending', reviewed_by = null, reviewed_at = null
   where id = coalesce(new.lesson_id, old.lesson_id) and status = 'approved';
  return coalesce(new, old);
end;
$$;
revoke execute on function public.lesson_part_changed() from public, anon, authenticated;
create trigger lesson_checkpoints_changed
  after insert or update or delete on public.lesson_checkpoints
  for each row execute function public.lesson_part_changed();
create trigger lesson_authorities_changed
  after insert or update or delete on public.lesson_authorities
  for each row execute function public.lesson_part_changed();

-- ---------------------------------------------------------------------------
-- 2. Each student's own learning records.
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  lesson_id uuid references public.topic_lessons (id) on delete set null,
  lesson_version integer check (lesson_version >= 1),
  -- The day in Lagos: a second visit on the same day continues the same diary entry.
  study_date date not null default (now() at time zone 'Africa/Lagos')::date,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  -- Time actually spent reading (the app adds short active spells), at most 24 hours a day.
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400),
  -- Sections read so far, so an interrupted session continues where it stopped.
  sections_read integer not null default 0 check (sections_read between 0 and 200),
  completed_at timestamptz,
  unique (owner_id, topic_id, study_date)
);
alter table public.study_sessions enable row level security;
create index study_sessions_owner_idx on public.study_sessions (owner_id, study_date desc);

create table public.recall_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid references public.study_sessions (id) on delete set null,
  topic_id uuid not null references public.topics (id) on delete cascade,
  -- Kept even if the lesson is later rewritten: the diary still shows what was asked.
  checkpoint_id uuid references public.lesson_checkpoints (id) on delete set null,
  prompt text not null check (char_length(prompt) between 3 and 2000),
  key_point text not null check (char_length(key_point) between 2 and 200),
  context text not null check (context in ('reading', 'test', 'revision')),
  answer text check (char_length(answer) <= 4000),
  choice integer check (choice between 0 and 5),
  outcome text not null check (outcome in ('correct', 'partly', 'incorrect', 'skipped')),
  created_at timestamptz not null default now()
);
alter table public.recall_attempts enable row level security;
create index recall_attempts_owner_idx on public.recall_attempts (owner_id, created_at desc);
create index recall_attempts_session_idx on public.recall_attempts (session_id);

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  checkpoint_id uuid not null references public.lesson_checkpoints (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  due_at timestamptz not null,
  -- Days until the next revision after a correct answer (1, 3, 7, 14 ... adjusted by results).
  interval_days integer not null default 1 check (interval_days between 1 and 365),
  successes integer not null default 0 check (successes >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_outcome text check (last_outcome in ('correct', 'partly', 'incorrect', 'skipped')),
  last_reviewed_at timestamptz,
  unique (owner_id, checkpoint_id)
);
alter table public.review_items enable row level security;
create index review_items_due_idx on public.review_items (owner_id, due_at);

create table public.diary_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  unique (owner_id, topic_id)
);
alter table public.diary_notes enable row level security;
create trigger diary_notes_set_updated_at
  before update on public.diary_notes
  for each row execute function public.set_updated_at();

-- Owners only, for every one of these tables. Nobody else (staff included) reads a student's
-- learning records; admins see counts through their own reports, never the content.
create policy "Owners read their study sessions" on public.study_sessions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners start study sessions" on public.study_sessions
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update their study sessions" on public.study_sessions
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their study sessions" on public.study_sessions
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their recall attempts" on public.recall_attempts
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners record recall attempts" on public.recall_attempts
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (session_id is null or exists (
      select 1 from public.study_sessions s where s.id = session_id and s.owner_id = (select auth.uid()))));
create policy "Owners delete their recall attempts" on public.recall_attempts
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their review items" on public.review_items
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners add review items" on public.review_items
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update their review items" on public.review_items
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their review items" on public.review_items
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their notes" on public.diary_notes
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners write their notes" on public.diary_notes
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update their notes" on public.diary_notes
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their notes" on public.diary_notes
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Who may touch which columns. Visitors get nothing. The database sets versions, reviewers,
-- owners and times itself, so nobody can write those directly.
revoke all on public.topic_lessons, public.lesson_checkpoints, public.lesson_authorities,
  public.study_sessions, public.recall_attempts, public.review_items, public.diary_notes
  from anon, authenticated;

grant select on public.topic_lessons, public.lesson_checkpoints, public.lesson_authorities to authenticated;
grant insert (topic_id, title, content, model, prompt_version),
  update (title, content, status, model, prompt_version, review_note)
  on public.topic_lessons to authenticated;
grant insert (lesson_id, position, after_section, placement, kind, prompt, choices, correct_choice, answer, explanation, key_point, sources),
  update (position, after_section, placement, kind, prompt, choices, correct_choice, answer, explanation, key_point, sources),
  delete on public.lesson_checkpoints to authenticated;
grant insert (lesson_id, key, kind, name, citation, court, facts, issue, decision, principle, facts_from_library, sources),
  update (kind, name, citation, court, facts, issue, decision, principle, facts_from_library, sources),
  delete on public.lesson_authorities to authenticated;
grant delete on public.topic_lessons to authenticated;

grant select, delete on public.study_sessions, public.recall_attempts, public.review_items, public.diary_notes to authenticated;
grant insert (topic_id, lesson_id, lesson_version),
  update (last_active_at, active_seconds, sections_read, completed_at, lesson_id, lesson_version)
  on public.study_sessions to authenticated;
grant insert (session_id, topic_id, checkpoint_id, prompt, key_point, context, answer, choice, outcome)
  on public.recall_attempts to authenticated;
grant insert (checkpoint_id, topic_id, due_at, interval_days, successes, lapses, last_outcome, last_reviewed_at),
  update (due_at, interval_days, successes, lapses, last_outcome, last_reviewed_at)
  on public.review_items to authenticated;
grant insert (topic_id, body), update (body) on public.diary_notes to authenticated;
