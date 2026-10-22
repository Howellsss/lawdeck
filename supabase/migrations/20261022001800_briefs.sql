-- Lawdeck migration 18: case and statute briefs (Phase 4, step 4f; PRD LN-09).
-- A brief is written from approved library passages and saved for the student who asked for it.
-- Each student sees only their own briefs. Briefs are never edited; students delete their own.

create type public.brief_kind as enum ('case', 'statute');

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The course searched, or none for all courses.
  course_id uuid references public.courses (id) on delete set null,
  kind public.brief_kind not null,
  -- The case or statute as the student named it.
  name text not null check (char_length(name) between 2 and 300),
  -- The brief's sections, in order: [{"heading": "Facts", "text": "...", "covered": true}, ...]
  sections jsonb not null check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) between 1 and 12),
  -- The library passages it came from: label, title, heading, pages and passage id. Never their text.
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  model text check (char_length(model) <= 80),
  created_at timestamptz not null default now()
);
alter table public.briefs enable row level security;
create index briefs_owner_idx on public.briefs (owner_id, created_at desc);

revoke all on public.briefs from anon, authenticated;
grant select, delete on public.briefs to authenticated;
grant insert (course_id, kind, name, sections, sources, model) on public.briefs to authenticated;
create policy "Owners can read their briefs" on public.briefs
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners can save briefs" on public.briefs
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners can delete their briefs" on public.briefs
  for delete to authenticated using (owner_id = (select auth.uid()));

-- A brief counts as one question in the monthly allowance, like an explanation or a practice
-- set (founder, 2026-10-22). Same functions as migration 17, with the new 'brief' kind added.
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
  if kind is null or kind not in ('explain', 'route', 'transcribe', 'practice', 'brief') then
    raise exception 'Unknown kind of AI call.' using errcode = '22023';
  end if;
  insert into public.usage_events (owner_id, kind, model, tokens_in, tokens_out, cost_usd, duration_ms)
  values ((select auth.uid()), kind, left(model, 80), greatest(tokens_in, 0), greatest(tokens_out, 0),
          greatest(cost_usd, 0), greatest(duration_ms, 0));
end;
$$;

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
      where e.owner_id = me and e.kind in ('explain', 'practice', 'brief') and e.created_at >= month_start),
    coalesce(plan_limit, 0),
    public.is_reviewer() or (own_plan is not null and plan_limit is null);
end;
$$;
