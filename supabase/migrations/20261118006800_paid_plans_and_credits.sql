-- Lawdeck migration 68: paid plans and credits (launch task 15, part 1; founder 2026-11-18:
-- Flutterwave, pay each month, ₦3,999 / ₦8,499 / ₦13,999).
-- 1. Three paid plans: Standard, Pro and Max. A plan's monthly_message_limit is its monthly credits.
-- 2. Credits: bigger jobs cost more. Each AI request records its credits when it is made, from
--    credit_costs, so changing a cost never changes what was already used. Requests recorded
--    before this migration count 1 each, as before.
-- 3. A student is on a paid plan only while a paid month is running (an active subscription whose
--    period_end is still ahead); otherwise they are on Free. Payments write subscriptions in part
--    2 (a marked admin job); nobody can give themselves a plan.
-- 4. Admins change a plan's price and credits on Admin → Plans (save_plan), recorded in the
--    audit log.
-- Needs migrations 1–67.

-- 1. Paid plans ------------------------------------------------------------------------------
alter table public.plans
  add column position integer not null default 0,
  add column on_sale boolean not null default false;

update public.plans set position = 0 where name = 'Free';

insert into public.plans (name, price_ngn, monthly_message_limit, upload_limit, monthly_scan_page_limit, position, on_sale)
select v.name, v.price, v.credits, f.upload_limit, f.monthly_scan_page_limit, v.position, true
  from (values ('Standard', 3999, 80, 1), ('Pro', 8499, 180, 2), ('Max', 13999, 300, 3)) as v (name, price, credits, position)
  cross join (select upload_limit, monthly_scan_page_limit from public.plans where name = 'Free') f
on conflict (name) do nothing;

-- 2. Credits ---------------------------------------------------------------------------------
create table public.credit_costs (
  kind text primary key check (kind in ('explain', 'problem', 'practice', 'brief', 'marking', 'draft', 'memory_aid')),
  credits integer not null check (credits between 0 and 20),
  updated_at timestamptz not null default now()
);
alter table public.credit_costs enable row level security;
revoke all on public.credit_costs from anon, authenticated;
grant select on public.credit_costs to authenticated;
create policy "Signed-in users can read credit costs" on public.credit_costs
  for select to authenticated using (true);

-- An ordinary answer (and a voice reply that teaches) 1; a problem question, marking and a draft
-- 3; a brief 2; a practice set and a memory aid 1 (founder, 2026-11-18).
insert into public.credit_costs (kind, credits) values
  ('explain', 1), ('problem', 3), ('practice', 1), ('brief', 2), ('marking', 3), ('draft', 3), ('memory_aid', 1);

alter table public.usage_events
  add column credits smallint check (credits between 0 and 20);

-- 'problem' is a new kind: a problem question's answer (it was recorded as 'explain' before).
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
  if kind is null or kind not in ('explain', 'problem', 'route', 'transcribe', 'practice', 'brief', 'marking', 'draft', 'draft_pick', 'speech', 'talk_chat', 'memory_aid') then
    raise exception 'Unknown kind of AI call.' using errcode = '22023';
  end if;
  insert into public.usage_events (owner_id, kind, model, tokens_in, tokens_out, cost_usd, duration_ms, credits)
  values ((select auth.uid()), kind, left(model, 80), greatest(tokens_in, 0), greatest(tokens_out, 0),
          greatest(cost_usd, 0), greatest(duration_ms, 0),
          (select c.credits from public.credit_costs c where c.kind = record_ai_usage.kind));
end;
$$;

-- 3. Which plan a student is on ---------------------------------------------------------------
-- The plan of the latest paid month still running; else a free-priced plan set on the profile;
-- else Free.
create function public.current_plan_id(person uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.plan_id from public.subscriptions s
      where s.owner_id = person and s.status = 'active' and s.period_end > now()
      order by s.period_end desc limit 1),
    (select p.id from public.profiles pr join public.plans p on p.id = pr.plan_id
      where pr.id = person and coalesce(p.price_ngn, 0) = 0),
    (select p.id from public.plans p where p.name = 'Free')
  );
$$;
revoke execute on function public.current_plan_id(uuid) from public, anon, authenticated;

-- The signed-in student's plan and when its paid month ends (null on Free).
create function public.my_plan()
returns table (plan_id uuid, name text, price_ngn integer, credits integer, period_end timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  current uuid;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  current := public.current_plan_id(me);
  return query
  select p.id, p.name, p.price_ngn, p.monthly_message_limit,
    (select max(s.period_end) from public.subscriptions s
      where s.owner_id = me and s.plan_id = p.id and s.status = 'active' and s.period_end > now())
    from public.plans p where p.id = current;
end;
$$;
revoke execute on function public.my_plan() from public, anon;
grant execute on function public.my_plan() to authenticated;

-- The allowance (migration 50), now in credits and on the current plan. The short-period limit
-- for a public test still counts requests, as the Pilot page says.
create or replace function public.question_allowance()
returns table (
  used integer,
  monthly_limit integer,
  unlimited boolean,
  window_used integer,
  window_limit integer,
  window_resets_at timestamptz
)
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
  settings public.pilot_settings;
  staff boolean;
  access boolean;
  window_start timestamptz;
  oldest timestamptz;
  in_window integer;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  own_plan := public.current_plan_id(me);
  select p.monthly_message_limit into plan_limit from public.plans p where p.id = own_plan;
  select * into settings from public.pilot_settings s where s.id;
  staff := public.is_reviewer();
  access := public.has_pilot_access();

  -- The monthly cap applies to students on any plan, including unlimited ones.
  if not staff and settings.monthly_question_cap is not null then
    plan_limit := least(coalesce(plan_limit, settings.monthly_question_cap), settings.monthly_question_cap);
  end if;

  if not staff and settings.burst_limit is not null then
    window_start := now() - make_interval(hours => settings.burst_hours);
    select count(*)::integer, min(e.created_at) into in_window, oldest
      from public.usage_events e
     where e.owner_id = me and e.kind in ('explain', 'problem', 'practice', 'brief', 'marking', 'draft', 'memory_aid')
       and e.created_at >= window_start;
  end if;

  return query
  select
    (select coalesce(sum(coalesce(e.credits, 1)), 0)::integer from public.usage_events e
      where e.owner_id = me and e.kind in ('explain', 'problem', 'practice', 'brief', 'marking', 'draft', 'memory_aid')
        and e.created_at >= month_start),
    case when access then coalesce(plan_limit, 0) else 0 end,
    staff or (access and own_plan is not null and plan_limit is null),
    in_window,
    case when staff then null else settings.burst_limit end,
    case when in_window is not null and in_window >= settings.burst_limit
      then oldest + make_interval(hours => settings.burst_hours) end;
end;
$$;
revoke execute on function public.question_allowance() from public, anon;
grant execute on function public.question_allowance() to authenticated;

-- 4. Admin → Plans ------------------------------------------------------------------------------
-- Changes a plan's monthly price and credits. Admins only; recorded in the audit log. Students
-- who already paid keep what they paid for until their month ends (the Terms, section 3).
create function public.save_plan(plan uuid, price integer, credits integer)
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
  if price is null or price < 0 or price > 1000000 or credits is null or credits < 0 or credits > 100000 then
    raise exception 'Check the price and credits.' using errcode = '22023';
  end if;
  select * into before from public.plans p where p.id = plan for update;
  if not found then
    raise exception 'That plan could not be found.' using errcode = '23503';
  end if;
  if before.name = 'Free' and price <> 0 then
    raise exception 'The Free plan stays free.' using errcode = '22023';
  end if;
  update public.plans set price_ngn = price, monthly_message_limit = credits where id = plan;
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'plan_changed', 'plan', plan,
          jsonb_build_object('name', before.name, 'price_before', before.price_ngn, 'price_after', price,
                             'credits_before', before.monthly_message_limit, 'credits_after', credits));
end;
$$;
revoke execute on function public.save_plan(uuid, integer, integer) from public, anon;
grant execute on function public.save_plan(uuid, integer, integer) to authenticated;
