-- Migration 14: Phase 3, step 3d. A record of every AI call, and a monthly question limit.
-- Rules G-08 (log model, tokens, cost and time per call) and K-01 (limits checked on the server).
-- Prices and paid plans are still open decisions (PRD AC-03); until then everyone is on Free.

-- ---------------------------------------------------------------------------
-- The Free plan. Its limit can be changed here later without any code change:
--   update public.plans set monthly_message_limit = 50 where name = 'Free';
insert into public.plans (name, price_ngn, monthly_message_limit, upload_limit)
values ('Free', 0, 30, 50)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- record_ai_usage: the server records each AI call for the signed-in person. The owner always
-- comes from the sign-in, so nobody can record usage against someone else. Students still
-- cannot write usage_events directly (migration 3), nor change or delete it.
create function public.record_ai_usage(
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
  if kind is null or kind not in ('explain', 'route', 'transcribe') then
    raise exception 'Unknown kind of AI call.' using errcode = '22023';
  end if;
  insert into public.usage_events (owner_id, kind, model, tokens_in, tokens_out, cost_usd, duration_ms)
  values ((select auth.uid()), kind, left(model, 80), greatest(tokens_in, 0), greatest(tokens_out, 0),
          greatest(cost_usd, 0), greatest(duration_ms, 0));
end;
$$;
revoke execute on function public.record_ai_usage(text, text, integer, integer, numeric, integer) from public, anon;
grant execute on function public.record_ai_usage(text, text, integer, integer, numeric, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- question_allowance: how many questions the signed-in person has asked this month, out of how
-- many. A question counts once its answer has been written by the AI (an "explain" call);
-- failed answers and "nothing in the library" replies are free. The month runs in Lagos time.
-- Reviewers and admins are not limited. A student without a plan is on Free.
create function public.question_allowance()
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
  -- A plan whose limit is empty has no limit (for paid plans later).
  select p.monthly_message_limit into plan_limit from public.plans p where p.id = own_plan;
  return query
  select
    (select count(*)::integer from public.usage_events e
      where e.owner_id = me and e.kind = 'explain' and e.created_at >= month_start),
    coalesce(plan_limit, 0),
    public.is_reviewer() or (own_plan is not null and plan_limit is null);
end;
$$;
revoke execute on function public.question_allowance() from public, anon;
grant execute on function public.question_allowance() to authenticated;
