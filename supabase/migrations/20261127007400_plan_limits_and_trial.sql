-- Lawdeck migration 74: limits like Claude's, the 7-day free trial, and credits that start on the
-- day a student pays (founder, 2026-11-27: "reset after every three hours, lets have that weekly
-- limit as well like claude"; prices from the investor deck, "Option 1").
-- 1. Plans get a 3-hour window (credits that refill 3 hours after the first use in the window)
--    and a weekly limit. The monthly credits stay the overall ceiling, so no plan can cost more
--    than its monthly credits.
--      Free trial: 7 every 3 hours, 30 in all, for 7 days
--      Standard ₦4,999: 8 every 3 hours, 25 a week, 70 a month
--      Pro ₦9,999: 15 every 3 hours, 50 a week, 150 a month
--      Max ₦14,999: 25 every 3 hours, 75 a week, 230 a month
-- 2. A paid month's credits start on the day the student paid (not the 1st of the calendar
--    month); weeks are counted from that day too.
-- 3. The Free plan becomes a 7-day trial: it starts when the account is made, or when this
--    migration runs for accounts made before it (so testers get their 7 days too).
-- 4. Admins change the 3-hour and weekly limits on Admin → Plans (save_plan_limits, audited).
-- 5. Limits now count credits everywhere. The short-period setting on the Pilot page still
--    applies when it is stricter than a plan's own 3-hour window.
-- Needs migrations 1–73.

-- 1. Plan settings ---------------------------------------------------------------------------
alter table public.plans
  add column window_credits integer check (window_credits between 1 and 10000),
  add column window_hours integer not null default 3 check (window_hours between 1 and 24),
  add column weekly_credits integer check (weekly_credits between 1 and 100000),
  add column trial_days integer check (trial_days between 1 and 60),
  add column trial_from timestamptz;

update public.plans set window_credits = 7, trial_days = 7, trial_from = now(), monthly_message_limit = 30 where name = 'Free';
update public.plans set price_ngn = 4999, monthly_message_limit = 70, window_credits = 8, weekly_credits = 25 where name = 'Standard';
update public.plans set price_ngn = 9999, monthly_message_limit = 150, window_credits = 15, weekly_credits = 50 where name = 'Pro';
update public.plans set price_ngn = 14999, monthly_message_limit = 230, window_credits = 25, weekly_credits = 75 where name = 'Max';

-- 2–3. The allowance --------------------------------------------------------------------------
drop function public.question_allowance();
create function public.question_allowance()
returns table (
  used integer,
  monthly_limit integer,
  unlimited boolean,
  window_used integer,
  window_limit integer,
  window_resets_at timestamptz,
  week_used integer,
  week_limit integer,
  week_resets_at timestamptz,
  period_ends_at timestamptz,
  trial boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  kinds text[] := array['explain', 'problem', 'practice', 'brief', 'marking', 'draft', 'memory_aid'];
  own_plan uuid;
  plan public.plans;
  settings public.pilot_settings;
  staff boolean;
  access boolean;
  paid_end timestamptz;
  period_start timestamptz;
  period_end timestamptz;
  is_trial boolean := false;
  plan_limit integer;
  win_limit integer;
  win_hours integer;
  win_used integer;
  win_oldest timestamptz;
  wk_start timestamptz;
  wk_used integer;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  own_plan := public.current_plan_id(me);
  select * into plan from public.plans p where p.id = own_plan;
  select * into settings from public.pilot_settings s where s.id;
  staff := public.is_reviewer();
  access := public.has_pilot_access();
  plan_limit := plan.monthly_message_limit;

  -- The paid month running now: the earliest active subscription not yet ended.
  select min(s.period_end) into paid_end from public.subscriptions s
   where s.owner_id = me and s.status = 'active' and s.period_end > now();
  if paid_end is not null then
    period_start := paid_end - interval '1 month';
    period_end := paid_end;
  elsif plan.trial_days is not null then
    is_trial := true;
    select greatest(u.created_at, coalesce(plan.trial_from, u.created_at)) into period_start from auth.users u where u.id = me;
    period_start := coalesce(period_start, now());
    period_end := period_start + make_interval(days => plan.trial_days);
    if now() >= period_end then
      plan_limit := 0;
    end if;
  else
    period_start := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
    period_end := (date_trunc('month', now() at time zone 'Africa/Lagos') + interval '1 month') at time zone 'Africa/Lagos';
  end if;

  -- The monthly cap on the Pilot page applies to students on any plan, including unlimited ones.
  if not staff and settings.monthly_question_cap is not null then
    plan_limit := least(coalesce(plan_limit, settings.monthly_question_cap), settings.monthly_question_cap);
  end if;

  -- The 3-hour window: the plan's own, or the Pilot page's short-period limit when that is stricter.
  if not staff then
    if plan.window_credits is not null then
      win_limit := plan.window_credits;
      win_hours := plan.window_hours;
    end if;
    if settings.burst_limit is not null and (win_limit is null or settings.burst_limit < win_limit) then
      win_limit := settings.burst_limit;
      win_hours := settings.burst_hours;
    end if;
  end if;
  if win_limit is not null then
    select coalesce(sum(coalesce(e.credits, 1)), 0)::integer, min(e.created_at) into win_used, win_oldest
      from public.usage_events e
     where e.owner_id = me and e.kind = any (kinds) and e.created_at >= now() - make_interval(hours => win_hours);
  end if;

  -- The week: counted in 7-day blocks from the start of the paid month (or trial).
  if not staff and plan.weekly_credits is not null then
    wk_start := period_start + floor(extract(epoch from now() - period_start) / 604800) * interval '7 days';
    select coalesce(sum(coalesce(e.credits, 1)), 0)::integer into wk_used
      from public.usage_events e
     where e.owner_id = me and e.kind = any (kinds) and e.created_at >= wk_start;
  end if;

  return query
  select
    (select coalesce(sum(coalesce(e.credits, 1)), 0)::integer from public.usage_events e
      where e.owner_id = me and e.kind = any (kinds) and e.created_at >= period_start),
    case when access then coalesce(plan_limit, 0) else 0 end,
    staff or (access and own_plan is not null and plan_limit is null),
    win_used,
    win_limit,
    case when win_used is not null and win_used >= win_limit then win_oldest + make_interval(hours => win_hours) end,
    wk_used,
    case when wk_used is null then null else plan.weekly_credits end,
    case when wk_used is not null and wk_used >= plan.weekly_credits then least(wk_start + interval '7 days', period_end) end,
    case when staff then null else period_end end,
    is_trial and not staff;
end;
$$;
revoke execute on function public.question_allowance() from public, anon;
grant execute on function public.question_allowance() to authenticated;

-- 4. Admin → Plans: the 3-hour and weekly limits --------------------------------------------------
create function public.save_plan_limits(plan uuid, window_limit integer, weekly_limit integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  before public.plans;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change plans.' using errcode = '42501';
  end if;
  if (window_limit is not null and (window_limit < 1 or window_limit > 10000))
     or (weekly_limit is not null and (weekly_limit < 1 or weekly_limit > 100000)) then
    raise exception 'Check the limits.' using errcode = '22023';
  end if;
  select * into before from public.plans p where p.id = plan for update;
  if not found then
    raise exception 'That plan could not be found.' using errcode = '23503';
  end if;
  update public.plans set window_credits = window_limit, weekly_credits = weekly_limit where id = plan;
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'plan_limits_changed', 'plan', plan,
          jsonb_build_object('name', before.name, 'window_before', before.window_credits, 'window_after', window_limit,
                             'weekly_before', before.weekly_credits, 'weekly_after', weekly_limit));
end;
$$;
revoke execute on function public.save_plan_limits(uuid, integer, integer) from public, anon;
grant execute on function public.save_plan_limits(uuid, integer, integer) to authenticated;
