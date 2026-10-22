-- Lawdeck migration 17: practice (Phase 4, step 4a). System Design §3 and §4.2; PRD LN-06 to LN-08.
-- 1. practice_sets and practice_items: a student's practice questions and flashcards, made from
--    the library. Each student sees only their own.
-- 2. attempts: each answer a student gives, with its score and feedback. Their own only.
-- 3. rubrics: marking guides, written and approved by reviewers. Students never read them
--    directly (System Design §4.2: "used in marking; not shown in full").
-- 4. A practice set counts as one question in the monthly allowance (founder, 2026-10-22).

create type public.practice_kind as enum ('mcq', 'scenario', 'flashcards');

-- So a set can name a topic only from its own course.
alter table public.topics add constraint topics_id_course_key unique (id, course_id);

-- ---------------------------------------------------------------------------
-- 1. Sets and their items.
create table public.practice_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  topic_id uuid,
  kind public.practice_kind not null,
  title text not null check (char_length(title) between 1 and 200),
  model text check (char_length(model) <= 80),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (topic_id, course_id) references public.topics (id, course_id) on delete set null (topic_id)
);
alter table public.practice_sets enable row level security;
create index practice_sets_owner_idx on public.practice_sets (owner_id, created_at desc);

create table public.practice_items (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null check (position between 0 and 49),
  question text not null check (char_length(question) between 1 and 4000),
  -- Multiple choice only: the options, and which one is right (counting from 0).
  choices jsonb check (choices is null or (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 6)),
  correct_choice integer check (correct_choice between 0 and 5),
  -- The model answer or explanation (the back of a flashcard).
  answer text not null check (char_length(answer) between 1 and 8000),
  -- The library passages it came from: label, title, heading, pages and passage id. Never their text.
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  -- Flashcards: the student's own "know it" (true) or "not yet" (false) mark.
  known boolean,
  created_at timestamptz not null default now(),
  unique (set_id, position),
  unique (id, owner_id),
  check ((choices is null) = (correct_choice is null)),
  check (correct_choice is null or correct_choice < jsonb_array_length(choices)),
  -- An item can only go into a set owned by the same student.
  foreign key (set_id, owner_id) references public.practice_sets (id, owner_id) on delete cascade
);
alter table public.practice_items enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Rubrics (before attempts, which may name one).
create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  topic_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  -- The points a good answer makes, each with its marks: [{"point": "...", "marks": 2}, ...]
  criteria jsonb not null default '[]' check (jsonb_typeof(criteria) = 'array'),
  status public.review_status not null default 'pending',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (topic_id, course_id) references public.topics (id, course_id) on delete set null (topic_id)
);
alter table public.rubrics enable row level security;
create index rubrics_course_topic_idx on public.rubrics (course_id, topic_id);
create trigger rubrics_set_updated_at
  before update on public.rubrics
  for each row execute function public.set_updated_at();

-- The database records who approved a rubric and when (never trusted from the browser).
create function public.rubrics_reviewed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;
create trigger rubrics_reviewed
  before update on public.rubrics
  for each row execute function public.rubrics_reviewed();

-- ---------------------------------------------------------------------------
-- 2. Attempts.
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  rubric_id uuid references public.rubrics (id) on delete set null,
  -- Multiple choice: the option picked. Written answers: the text.
  choice integer check (choice between 0 and 5),
  answer_text text check (char_length(answer_text) <= 20000),
  score numeric(5, 2) check (score between 0 and 100),
  -- Marking feedback (step 4e): what was good, what was missing, the correct rule.
  feedback jsonb,
  model text check (char_length(model) <= 80),
  created_at timestamptz not null default now(),
  check (choice is not null or answer_text is not null),
  -- An attempt can only answer the student's own item.
  foreign key (item_id, owner_id) references public.practice_items (id, owner_id) on delete cascade
);
alter table public.attempts enable row level security;
create index attempts_owner_item_idx on public.attempts (owner_id, item_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Who may do what. Visitors get nothing.
revoke all on public.practice_sets, public.practice_items, public.attempts, public.rubrics from anon, authenticated;

-- Sets: owners create, read and delete their own (items and attempts go with them).
grant select, delete on public.practice_sets to authenticated;
grant insert (course_id, topic_id, kind, title, model) on public.practice_sets to authenticated;
create policy "Owners can read their practice sets" on public.practice_sets
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners can create practice sets" on public.practice_sets
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners can delete their practice sets" on public.practice_sets
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Items: owners add them to their own sets and read them; the only change is the flashcard mark.
grant select on public.practice_items to authenticated;
grant insert (set_id, position, question, choices, correct_choice, answer, sources) on public.practice_items to authenticated;
grant update (known) on public.practice_items to authenticated;
create policy "Owners can read their practice items" on public.practice_items
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners can add practice items" on public.practice_items
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners can mark their flashcards" on public.practice_items
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Attempts: owners add and read their own. Attempts are never edited.
grant select on public.attempts to authenticated;
grant insert (item_id, rubric_id, choice, answer_text, score, feedback, model) on public.attempts to authenticated;
create policy "Owners can read their attempts" on public.attempts
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners can add attempts" on public.attempts
  for insert to authenticated with check (owner_id = (select auth.uid()));

-- Rubrics: reviewers and admins read, write and approve them; admins remove them. Students
-- have no access: marking (step 4e) reads the approved rubric on the server.
grant select on public.rubrics to authenticated;
grant insert (course_id, topic_id, title, criteria), update (title, topic_id, criteria, status) on public.rubrics to authenticated;
grant delete on public.rubrics to authenticated;
create policy "Reviewers read rubrics" on public.rubrics
  for select to authenticated using (public.is_reviewer());
create policy "Reviewers write rubrics" on public.rubrics
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers change rubrics" on public.rubrics
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Admins remove rubrics" on public.rubrics
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. The monthly allowance counts practice sets too. Same functions as migration 14, with
-- the new 'practice' kind added.
create or replace function public.record_ai_usage(
  kind text,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric,
  duration_ms integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if kind is null or kind not in ('explain', 'route', 'transcribe', 'practice') then
    raise exception 'Unknown kind of AI call.' using errcode = '22023';
  end if;
  insert into public.usage_events (owner_id, kind, model, tokens_in, tokens_out, cost_usd, duration_ms)
  values ((select auth.uid()), kind, left(model, 80), greatest(tokens_in, 0), greatest(tokens_out, 0),
          greatest(cost_usd, 0), greatest(duration_ms, 0));
end;
$$;

-- A question counts once its answer is written (an "explain" call); a practice set counts once
-- its questions are written (a "practice" call). Failed calls are free.
create or replace function public.question_allowance()
returns table (used integer, monthly_limit integer, unlimited boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  own_plan uuid;
  plan_limit integer;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select pr.plan_id into own_plan from public.profiles pr where pr.id = me;
  if own_plan is null then
    select p.id into own_plan from public.plans p where p.name = 'Free';
  end if;
  select p.monthly_message_limit into plan_limit from public.plans p where p.id = own_plan;
  return query
  select
    (select count(*)::integer from public.usage_events e
      where e.owner_id = me and e.kind in ('explain', 'practice') and e.created_at >= month_start),
    coalesce(plan_limit, 0),
    public.is_reviewer() or (own_plan is not null and plan_limit is null);
end;
$$;
