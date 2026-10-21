-- Lawdeck migration 3 of 3: AI usage records and the audit log.

-- ---------------------------------------------------------------------------
-- usage_events: one row per AI call, for limits and cost (rules G-08, K-01).
-- Students can read their own. How the server writes them is decided in Phase 3,
-- when AI answers are switched on; until then nothing in the app can write here.
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 40),
  model text,
  tokens_in integer check (tokens_in >= 0),
  tokens_out integer check (tokens_out >= 0),
  cost_usd numeric(12, 6) check (cost_usd >= 0),
  duration_ms integer check (duration_ms >= 0),
  created_at timestamptz not null default now()
);
alter table public.usage_events enable row level security;
create index usage_events_owner_created_idx on public.usage_events (owner_id, created_at desc);

revoke all on public.usage_events from anon, authenticated;
grant select on public.usage_events to authenticated;
create policy "People can read their own usage" on public.usage_events
  for select to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- audit_log: sign-ins, sharing, approvals and role changes. Never document text (rule I-03).
-- No student access at all: row-level security is on and there are no policies.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 60),
  target_type text check (char_length(target_type) <= 40),
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index audit_log_created_idx on public.audit_log (created_at desc);

revoke all on public.audit_log from anon, authenticated;
