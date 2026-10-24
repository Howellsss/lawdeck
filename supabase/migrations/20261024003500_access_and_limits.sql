-- Lawdeck migration 35: giving people access from the Users page, and limits for a public test.
-- Approved by the founder, 2026-10-24 ("approve the rest"; invite-only made easy from the Users page).
-- 1. set_pilot_access(person, allow): an admin gives or removes someone's access while invite-only
--    is on (the same access an invite code gives). Recorded in audit_log. Admins only.
-- 2. Four optional limits in pilot_settings, set on the admin Pilot page. Empty means "no extra
--    limit"; reviewers and admins are never limited:
--      - burst_limit questions per burst_hours hours (for example 5 every 3 hours);
--      - monthly_question_cap: at most this many questions a month, whatever the plan;
--      - monthly_scan_page_cap: at most this many scanned pages a month.
-- 3. question_allowance() also returns the burst window (used, limit, when it frees up), and
--    applies the monthly cap. scan_pages_left() applies the scan cap.
-- Questions means every AI request a student makes: explanations, practice, briefs, marking, drafts.

-- ---------------------------------------------------------------------------
-- 1. Giving or removing access.
create function public.set_pilot_access(person uuid, allow boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if person is null or allow is null then
    raise exception 'Say who, and whether to give or remove access.' using errcode = '22023';
  end if;
  update public.profiles pr
     set pilot_access_at = case when allow then coalesce(pr.pilot_access_at, now()) else null end
   where pr.id = person;
  if not found then
    return 'not_found';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values ((select auth.uid()), case when allow then 'pilot_access_given' else 'pilot_access_removed' end, 'profile', person);
  return 'ok';
end;
$$;
revoke execute on function public.set_pilot_access(uuid, boolean) from public, anon;
grant execute on function public.set_pilot_access(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Limits.
alter table public.pilot_settings
  add column burst_limit integer check (burst_limit between 1 and 100),
  add column burst_hours integer check (burst_hours between 1 and 24),
  add column monthly_question_cap integer check (monthly_question_cap between 1 and 1000),
  add column monthly_scan_page_cap integer check (monthly_scan_page_cap between 0 and 1000),
  add constraint pilot_settings_burst_pair check ((burst_limit is null) = (burst_hours is null));
grant update (burst_limit, burst_hours, monthly_question_cap, monthly_scan_page_cap)
  on public.pilot_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The allowance, with the burst window and the caps. Its columns change, so it is replaced.
drop function public.question_allowance();
create function public.question_allowance()
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
  select pr.plan_id into own_plan from public.profiles pr where pr.id = me;
  if own_plan is null then
    select p.id into own_plan from public.plans p where p.name = 'Free';
  end if;
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
     where e.owner_id = me and e.kind in ('explain', 'practice', 'brief', 'marking', 'draft')
       and e.created_at >= window_start;
  end if;

  return query
  select
    (select count(*)::integer from public.usage_events e
      where e.owner_id = me and e.kind in ('explain', 'practice', 'brief', 'marking', 'draft') and e.created_at >= month_start),
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

-- Scanned pages left, with the scan cap.
create or replace function public.scan_pages_left()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  page_limit integer;
  page_cap integer;
  used integer;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if public.is_reviewer() then
    return null;
  end if;
  if not public.has_pilot_access() then
    return 0;
  end if;
  select coalesce(p.monthly_scan_page_limit, free.monthly_scan_page_limit) into page_limit
    from public.profiles pr
    left join public.plans p on p.id = pr.plan_id
    cross join (select monthly_scan_page_limit from public.plans where name = 'Free') free
   where pr.id = me;
  select s.monthly_scan_page_cap into page_cap from public.pilot_settings s where s.id;
  if page_cap is not null then
    page_limit := least(coalesce(page_limit, page_cap), page_cap);
  end if;
  if page_limit is null then
    return null;
  end if;
  select coalesce(sum(s.pages), 0)::integer into used
    from public.scan_page_usage s where s.owner_id = me and s.created_at >= month_start;
  return greatest(page_limit - used, 0);
end;
$$;
