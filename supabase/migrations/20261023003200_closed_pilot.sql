-- Lawdeck migration 32: the closed pilot (Phase 8). Approved by the founder, 2026-10-23.
-- 1. pilot_settings: one row the admin changes: invite-only on or off, and the price question.
-- 2. invite_codes and invite_redemptions: codes the admin creates and sends to students. While
--    invite-only is on, a student without a redeemed code has 0 questions and 0 scanned pages
--    (question_allowance and scan_pages_left below), so nothing costs money until they are invited.
-- 3. price_answers: "Would you pay N... a month?" (yes, maybe, no), one answer per price per student.
-- 4. pilot_metrics(): weekly counts for the admin's pilot page. Counts only, never who.
-- Row-level security on every new table.

-- ---------------------------------------------------------------------------
-- 1. Pilot settings (a single row).
create table public.pilot_settings (
  id boolean primary key default true check (id),
  invite_only boolean not null default false,
  price_ngn integer check (price_ngn between 100 and 1000000),
  price_question_open boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not price_question_open or price_ngn is not null)
);
alter table public.pilot_settings enable row level security;
insert into public.pilot_settings (id) values (true) on conflict (id) do nothing;
create trigger pilot_settings_set_updated_at
  before update on public.pilot_settings
  for each row execute function public.set_updated_at();

revoke all on public.pilot_settings from anon, authenticated;
grant select on public.pilot_settings to authenticated;
grant update (invite_only, price_ngn, price_question_open) on public.pilot_settings to authenticated;
create policy "Signed-in people read the pilot settings" on public.pilot_settings
  for select to authenticated using (true);
create policy "Admins change the pilot settings" on public.pilot_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Invite codes.
alter table public.profiles add column pilot_access_at timestamptz;

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  -- 10 characters from 31 letters and digits that are easy to read: about 8 x 10^14 possible codes.
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$'),
  label text not null check (char_length(label) between 1 and 80),
  max_uses integer not null default 1 check (max_uses between 1 and 500),
  uses integer not null default 0 check (uses >= 0 and uses <= max_uses),
  expires_at timestamptz,
  disabled boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;

create table public.invite_redemptions (
  code_id uuid not null references public.invite_codes (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id)
);
alter table public.invite_redemptions enable row level security;
create index invite_redemptions_code_idx on public.invite_redemptions (code_id);

-- Admins manage codes; students never see them, and redeem only through redeem_invite().
revoke all on public.invite_codes, public.invite_redemptions from anon, authenticated;
grant select, insert, delete on public.invite_codes to authenticated;
grant update (disabled) on public.invite_codes to authenticated;
grant select on public.invite_redemptions to authenticated;
create policy "Admins see invite codes" on public.invite_codes
  for select to authenticated using (public.is_admin());
create policy "Admins create invite codes" on public.invite_codes
  for insert to authenticated with check (public.is_admin() and uses = 0);
create policy "Admins disable invite codes" on public.invite_codes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete unused invite codes" on public.invite_codes
  for delete to authenticated using (public.is_admin() and uses = 0);
create policy "Admins see redemptions" on public.invite_redemptions
  for select to authenticated using (public.is_admin());

-- Whether the signed-in person may use the AI features: always outside invite-only mode; for
-- reviewers and admins; and for students who have redeemed a code.
create function public.has_pilot_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    not coalesce((select s.invite_only from public.pilot_settings s where s.id), false)
    or public.is_reviewer()
    or exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.pilot_access_at is not null)
  );
$$;
revoke execute on function public.has_pilot_access() from public, anon;
grant execute on function public.has_pilot_access() to authenticated;

-- Redeems a code for the signed-in person: 'ok', 'already', 'invalid' or 'used_up'.
create function public.redeem_invite(code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  invite public.invite_codes%rowtype;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles pr where pr.id = me and pr.pilot_access_at is not null) then
    return 'already';
  end if;
  select * into invite from public.invite_codes c
   where c.code = upper(trim(redeem_invite.code)) and not c.disabled
     and (c.expires_at is null or c.expires_at > now())
   for update;
  if invite.id is null then
    return 'invalid';
  end if;
  if invite.uses >= invite.max_uses then
    return 'used_up';
  end if;
  update public.invite_codes set uses = uses + 1 where id = invite.id;
  insert into public.invite_redemptions (code_id, owner_id) values (invite.id, me);
  update public.profiles set pilot_access_at = now() where id = me;
  return 'ok';
end;
$$;
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- The question allowance (migration 23), now 0 for anyone without pilot access while invite-only is on.
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
    case when public.has_pilot_access() then coalesce(plan_limit, 0) else 0 end,
    public.is_reviewer() or (public.has_pilot_access() and own_plan is not null and plan_limit is null);
end;
$$;

-- Scanned pages left (migration 25), now 0 for anyone without pilot access while invite-only is on.
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
  if page_limit is null then
    return null;
  end if;
  select coalesce(sum(s.pages), 0)::integer into used
    from public.scan_page_usage s where s.owner_id = me and s.created_at >= month_start;
  return greatest(page_limit - used, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The price question.
create table public.price_answers (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  price_ngn integer not null check (price_ngn between 100 and 1000000),
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  primary key (owner_id, price_ngn)
);
alter table public.price_answers enable row level security;
revoke all on public.price_answers from anon, authenticated;
grant select, insert on public.price_answers to authenticated;
create policy "Students see their own price answers" on public.price_answers
  for select to authenticated using (owner_id = (select auth.uid()));
-- Only for the price currently asked, while the question is open.
create policy "Students answer the open price question" on public.price_answers
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.pilot_settings s
                 where s.id and s.price_question_open and s.price_ngn = price_answers.price_ngn)
  );

-- ---------------------------------------------------------------------------
-- 4. Weekly pilot counts for the admin (Lagos weeks, Monday to Sunday). Reviewers and admins
-- are left out of student counts. Counts and sums only, never who.
create function public.pilot_metrics(weeks integer default 6)
returns table (week_start date, metric text, value numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  first_week timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if weeks is null or weeks < 1 or weeks > 26 then
    raise exception 'Weeks must be between 1 and 26.' using errcode = '22023';
  end if;
  first_week := (date_trunc('week', now() at time zone 'Africa/Lagos') - make_interval(weeks => weeks - 1)) at time zone 'Africa/Lagos';
  return query
  with students as (
    select pr.id from public.profiles pr where pr.role = 'student'
  ),
  events as (
    select e.owner_id, e.kind, e.cost_usd,
           (date_trunc('week', e.created_at at time zone 'Africa/Lagos'))::date as wk
      from public.usage_events e
     where e.created_at >= first_week
  )
  select ev.wk, 'active_students', count(distinct ev.owner_id)::numeric
    from events ev join students s on s.id = ev.owner_id
   where ev.kind in ('explain', 'practice', 'brief', 'marking', 'draft') group by ev.wk
  union all
  select ev.wk, 'questions', count(*)::numeric
    from events ev join students s on s.id = ev.owner_id
   where ev.kind in ('explain', 'practice', 'brief', 'marking', 'draft') group by ev.wk
  union all
  select ev.wk, 'ai_cost_usd', round(sum(ev.cost_usd), 4) from events ev group by ev.wk
  union all
  select (date_trunc('week', d.created_at at time zone 'Africa/Lagos'))::date, 'documents_drafted', count(*)::numeric
    from public.documents d join students s on s.id = d.owner_id
   where d.created_at >= first_week group by 1
  union all
  select (date_trunc('week', r.created_at at time zone 'Africa/Lagos'))::date, 'invites_redeemed', count(*)::numeric
    from public.invite_redemptions r where r.created_at >= first_week group by 1
  union all
  select (date_trunc('week', p.created_at at time zone 'Africa/Lagos'))::date, 'problem_reports', count(*)::numeric
    from public.problem_reports p where p.created_at >= first_week group by 1;
end;
$$;
revoke execute on function public.pilot_metrics(integer) from public, anon;
grant execute on function public.pilot_metrics(integer) to authenticated;

-- Totals that are not weekly: week-4 retention and the price answers. Admins only.
create function public.pilot_summary()
returns table (metric text, value numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_price integer;
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  select s.price_ngn into current_price from public.pilot_settings s where s.id;
  return query
  with first_use as (
    select e.owner_id, min(e.created_at) as started
      from public.usage_events e join public.profiles pr on pr.id = e.owner_id and pr.role = 'student'
     where e.kind in ('explain', 'practice', 'brief', 'marking', 'draft')
     group by e.owner_id
  ),
  -- Students who started at least 4 weeks ago, and of those, who were active in their 4th week.
  cohort as (
    select f.owner_id, f.started from first_use f where f.started <= now() - interval '28 days'
  ),
  retained as (
    select c.owner_id from cohort c
     where exists (select 1 from public.usage_events e
                    where e.owner_id = c.owner_id
                      and e.kind in ('explain', 'practice', 'brief', 'marking', 'draft')
                      and e.created_at >= c.started + interval '21 days'
                      and e.created_at < c.started + interval '28 days')
  )
  select 'students_started', (select count(*) from first_use)::numeric
  union all select 'week4_cohort', (select count(*) from cohort)::numeric
  union all select 'week4_retained', (select count(*) from retained)::numeric
  union all select 'price_ngn', current_price::numeric
  union all select 'price_yes', (select count(*) from public.price_answers a where a.price_ngn = current_price and a.answer = 'yes')::numeric
  union all select 'price_maybe', (select count(*) from public.price_answers a where a.price_ngn = current_price and a.answer = 'maybe')::numeric
  union all select 'price_no', (select count(*) from public.price_answers a where a.price_ngn = current_price and a.answer = 'no')::numeric;
end;
$$;
revoke execute on function public.pilot_summary() from public, anon;
grant execute on function public.pilot_summary() to authenticated;
