-- Lawdeck migration 23: drafting counts in the AI usage record (Phase 5, step 5d).
-- 1. record_ai_usage accepts two more kinds: 'draft' (Opus writes a document's narrative parts)
--    and 'draft_pick' (Haiku matches a typed request to an approved template).
-- 2. A written draft counts as one question in the monthly allowance (founder, 2026-10-23).
--    Matching a request to a template is free, like Auto routing.
-- Functions only: no table changes.

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
  if kind is null or kind not in ('explain', 'route', 'transcribe', 'practice', 'brief', 'marking', 'draft', 'draft_pick') then
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
      where e.owner_id = me and e.kind in ('explain', 'practice', 'brief', 'marking', 'draft') and e.created_at >= month_start),
    coalesce(plan_limit, 0),
    public.is_reviewer() or (own_plan is not null and plan_limit is null);
end;
$$;
