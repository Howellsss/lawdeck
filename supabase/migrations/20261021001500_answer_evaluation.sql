-- Migration 15: Phase 3, step 3e. Results of the answer quality test, kept private.
-- The test (jobs/explain-eval.job.ts, a marked admin job with the service key) puts each test
-- case through the real answer pipeline on each model and saves the answers here. The legal
-- reviewer rates each answer on /admin/eval. The answers quote library material, so they are
-- never written to GitHub logs (the repository is public) and students can never see them.

create type public.eval_rating as enum ('approved', 'needs_fix');

-- ---------------------------------------------------------------------------
create table public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_version text not null check (char_length(prompt_version) between 1 and 40),
  models text[] not null,
  case_count integer not null check (case_count >= 0),
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.eval_answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.eval_runs (id) on delete cascade,
  case_id text not null check (char_length(case_id) between 1 and 20),
  case_kind text not null check (case_kind in ('question', 'pushback')),
  pushback_type text check (pushback_type in ('wrong_statement', 'holds_position', 'fake_authority', 'valid_correction')),
  topic text,
  level text check (level in ('simple', 'exam')),
  -- Earlier turns of a pushback case, then the question the answer replies to.
  turns jsonb not null default '[]',
  question text not null,
  must_include jsonb not null default '[]',
  expect text,
  model text not null,
  answer text,
  not_enough boolean,
  removed_authorities integer check (removed_authorities >= 0),
  sources jsonb not null default '[]',
  -- The automatic grader's view (points covered, pushback handled); the reviewer decides.
  grade jsonb,
  first_text_ms integer,
  total_ms integer,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(12, 6),
  error text,
  created_at timestamptz not null default now(),
  -- The legal reviewer's decision.
  rating public.eval_rating,
  review_note text check (char_length(review_note) <= 2000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  unique (run_id, case_id, model)
);
create index eval_answers_run_case_idx on public.eval_answers (run_id, case_id);

-- ---------------------------------------------------------------------------
-- Reviewers and admins read runs and answers, and rate answers. Nobody else sees anything.
-- Only the marked admin job (service key, which bypasses these rules) adds or removes rows.
alter table public.eval_runs enable row level security;
alter table public.eval_answers enable row level security;
revoke all on public.eval_runs, public.eval_answers from anon, authenticated;
grant select on public.eval_runs, public.eval_answers to authenticated;
grant update (rating, review_note) on public.eval_answers to authenticated;

create policy "Reviewers read test runs" on public.eval_runs
  for select to authenticated using (public.is_reviewer());
create policy "Reviewers read test answers" on public.eval_answers
  for select to authenticated using (public.is_reviewer());
create policy "Reviewers rate test answers" on public.eval_answers
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());

-- The database records who rated an answer and when (never trusted from the browser).
create function public.eval_answers_rated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rating is distinct from old.rating or new.review_note is distinct from old.review_note then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger eval_answers_rated
  before update on public.eval_answers
  for each row execute function public.eval_answers_rated();
