-- Lawdeck migration 34: the admin Users dashboard. Requested by the founder, 2026-10-24.
-- 1. subscriptions: who is on which paid plan and whether their payment is current (System Design §3).
--    Nothing in the app writes it yet: rows will come from the Nigerian payment provider once one is
--    chosen (Build Phases: founder decision). Until then every student shows as "Not paid".
-- 2. admin_overview(): headline counts for the dashboard. Students only (reviewers and admins left out).
-- 3. admin_signups_by_day(): new students per Lagos day, for the sign-ups chart.
-- 4. admin_users(): the list of people with email, name, plan, payment and activity. Admins only.
-- 5. admin_user_detail(): one person's account and usage counts. Admins only.
-- Emails live in Supabase's sign-in table, which the app cannot read; these owner-rights functions
-- read it only after checking the caller is an admin. They return counts and account details,
-- never document text, uploads or answers.

-- ---------------------------------------------------------------------------
-- 1. Subscriptions.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status text not null check (status in ('active', 'past_due', 'cancelled', 'expired')),
  amount_ngn integer check (amount_ngn >= 0),
  period_end timestamptz,
  provider text check (char_length(provider) between 1 and 40),
  -- The payment provider's own reference for this subscription (never card details).
  provider_ref text check (char_length(provider_ref) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create index subscriptions_owner_created_idx on public.subscriptions (owner_id, created_at desc);
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Students read their own; admins read all. Nobody writes from the app: the payment provider's
-- confirmation will be recorded by a marked admin job (rule: service-role key only in admin jobs).
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
create policy "Students read their own subscriptions" on public.subscriptions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Admins read all subscriptions" on public.subscriptions
  for select to authenticated using (public.is_admin());

-- A person's payment status from their latest subscription:
-- 'paid' (active and not past its end), 'past_due', 'lapsed' (had one, now ended) or 'never'.
create function public.payment_status(person uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
             when s.status = 'active' and (s.period_end is null or s.period_end > now()) then 'paid'
             when s.status = 'past_due' then 'past_due'
             else 'lapsed'
           end
      from public.subscriptions s
     where s.owner_id = person
     order by s.created_at desc, s.period_end desc nulls last
     limit 1
  ), 'never');
$$;
-- Only the admin functions below use it.
revoke execute on function public.payment_status(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Headline counts (Lagos days). Rows named 'plan:<name>' give students per plan.
create function public.admin_overview()
returns table (metric text, value numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  return query
  with students as (
    select pr.id, pr.plan_id, pr.created_at from public.profiles pr where pr.role = 'student'
  ),
  questions as (
    select e.owner_id, e.created_at from public.usage_events e
     where e.kind in ('explain', 'practice', 'brief', 'marking', 'draft') and e.created_at >= now() - interval '30 days'
  )
  select 'students_total', count(*)::numeric from students
  union all select 'joined_today', count(*)::numeric from students s where s.created_at >= today_start
  union all select 'joined_7d', count(*)::numeric from students s where s.created_at >= now() - interval '7 days'
  union all select 'joined_30d', count(*)::numeric from students s where s.created_at >= now() - interval '30 days'
  union all select 'paying', count(*)::numeric from students s where public.payment_status(s.id) = 'paid'
  union all select 'past_due', count(*)::numeric from students s where public.payment_status(s.id) = 'past_due'
  union all select 'active_7d', count(distinct q.owner_id)::numeric
    from questions q join students s on s.id = q.owner_id where q.created_at >= now() - interval '7 days'
  union all select 'active_30d', count(distinct q.owner_id)::numeric
    from questions q join students s on s.id = q.owner_id
  union all select 'questions_today', count(*)::numeric
    from questions q join students s on s.id = q.owner_id where q.created_at >= today_start
  union all select 'ai_cost_month_usd', coalesce(round(sum(e.cost_usd), 4), 0)
    from public.usage_events e where e.created_at >= month_start
  union all select 'plan:' || coalesce(p.name, 'Free'), count(*)::numeric
    from students s left join public.plans p on p.id = s.plan_id group by coalesce(p.name, 'Free');
end;
$$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. New students per Lagos day, oldest first, with days that had none.
create function public.admin_signups_by_day(days integer default 30)
returns table (day date, signups integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if days is null or days < 1 or days > 365 then
    raise exception 'Days must be between 1 and 365.' using errcode = '22023';
  end if;
  return query
  select d::date, count(pr.id)::integer
    from generate_series(today - (days - 1), today, interval '1 day') d
    left join public.profiles pr
      on pr.role = 'student' and (pr.created_at at time zone 'Africa/Lagos')::date = d::date
   group by d
   order by d;
end;
$$;
revoke execute on function public.admin_signups_by_day(integer) from public, anon;
grant execute on function public.admin_signups_by_day(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The people list, newest first, 1–100 at a time. Filters: words in the email or name;
-- a plan name ('Free' includes people with no plan set); payment ('paid', 'unpaid', 'past_due').
create function public.admin_users(
  search text default null,
  plan_name text default null,
  payment text default null,
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  role public.app_role,
  joined_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  sign_in_method text,
  plan text,
  payment_status text,
  paid_until timestamptz,
  pilot_access boolean,
  questions_this_month integer,
  last_active_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  pattern text;
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if page_size is null or page_size < 1 or page_size > 100 or page_offset is null or page_offset < 0 then
    raise exception 'Page size must be 1 to 100.' using errcode = '22023';
  end if;
  if payment is not null and payment not in ('paid', 'unpaid', 'past_due') then
    raise exception 'Unknown payment filter.' using errcode = '22023';
  end if;
  -- Search words are matched literally: % and _ in them are not wildcards.
  if nullif(trim(search), '') is not null then
    pattern := '%' || replace(replace(replace(trim(search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  return query
  with people as (
    select u.id, u.email::text as email,
           coalesce(nullif(trim(pr.full_name), ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name') as full_name,
           pr.role, pr.created_at as joined_at, u.last_sign_in_at, u.email_confirmed_at is not null as email_confirmed,
           coalesce(u.raw_app_meta_data ->> 'provider', 'email') as sign_in_method,
           coalesce(p.name, 'Free') as plan,
           public.payment_status(u.id) as payment_status,
           pr.pilot_access_at is not null as pilot_access
      from public.profiles pr
      join auth.users u on u.id = pr.id
      left join public.plans p on p.id = pr.plan_id
  ),
  matched as (
    select * from people pe
     where (pattern is null or pe.email ilike pattern or pe.full_name ilike pattern)
       and (admin_users.plan_name is null or pe.plan = admin_users.plan_name)
       and (admin_users.payment is null
            or (admin_users.payment = 'paid' and pe.payment_status = 'paid')
            or (admin_users.payment = 'past_due' and pe.payment_status = 'past_due')
            or (admin_users.payment = 'unpaid' and pe.payment_status <> 'paid'))
  )
  select m.id, m.email, m.full_name, m.role, m.joined_at, m.last_sign_in_at, m.email_confirmed, m.sign_in_method,
         m.plan, m.payment_status,
         (select s.period_end from public.subscriptions s
           where s.owner_id = m.id and s.status = 'active' order by s.created_at desc limit 1),
         m.pilot_access,
         (select count(*)::integer from public.usage_events e
           where e.owner_id = m.id and e.kind in ('explain', 'practice', 'brief', 'marking', 'draft') and e.created_at >= month_start),
         (select max(e.created_at) from public.usage_events e where e.owner_id = m.id),
         count(*) over ()
    from matched m
   order by m.joined_at desc, m.id
   limit page_size offset page_offset;
end;
$$;
revoke execute on function public.admin_users(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_users(text, text, text, integer, integer) to authenticated;

-- A time as ISO 8601 text (2026-10-24T05:56:00+00:00), which browsers read reliably.
create function public.iso_time(value timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_json(value) #>> '{}';
$$;
revoke execute on function public.iso_time(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. One person: their account details and how much they have used Lawdeck. Counts only.
create function public.admin_user_detail(person uuid)
returns table (metric text, value text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles pr where pr.id = person) then
    return;
  end if;
  return query
  select 'email', u.email::text from auth.users u where u.id = person
  union all select 'full_name', coalesce(nullif(trim(pr.full_name), ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
    from public.profiles pr join auth.users u on u.id = pr.id where pr.id = person
  union all select 'role', pr.role::text from public.profiles pr where pr.id = person
  union all select 'campus', pr.campus from public.profiles pr where pr.id = person
  union all select 'joined_at', public.iso_time(pr.created_at) from public.profiles pr where pr.id = person
  union all select 'last_sign_in_at', public.iso_time(u.last_sign_in_at) from auth.users u where u.id = person
  union all select 'email_confirmed', (u.email_confirmed_at is not null)::text from auth.users u where u.id = person
  union all select 'sign_in_method', coalesce(u.raw_app_meta_data ->> 'provider', 'email') from auth.users u where u.id = person
  union all select 'plan', coalesce(p.name, 'Free')
    from public.profiles pr left join public.plans p on p.id = pr.plan_id where pr.id = person
  union all select 'payment_status', public.payment_status(person)
  union all select 'paid_until', (select public.iso_time(s.period_end) from public.subscriptions s
    where s.owner_id = person and s.status = 'active' order by s.created_at desc limit 1)
  union all select 'pilot_access_at', public.iso_time(pr.pilot_access_at) from public.profiles pr where pr.id = person
  union all select 'invite_code', (select c.label || ' (' || c.code || ')' from public.invite_redemptions r
    join public.invite_codes c on c.id = r.code_id where r.owner_id = person)
  union all select 'questions_this_month', count(*)::text from public.usage_events e
    where e.owner_id = person and e.kind in ('explain', 'practice', 'brief', 'marking', 'draft') and e.created_at >= month_start
  union all select 'questions_total', count(*)::text from public.usage_events e
    where e.owner_id = person and e.kind in ('explain', 'practice', 'brief', 'marking', 'draft')
  union all select 'ai_cost_total_usd', coalesce(round(sum(e.cost_usd), 4), 0)::text from public.usage_events e where e.owner_id = person
  union all select 'last_active_at', public.iso_time(max(e.created_at)) from public.usage_events e where e.owner_id = person
  union all select 'chats', count(*)::text from public.conversations c where c.owner_id = person
  union all select 'projects', count(*)::text from public.projects pj where pj.owner_id = person
  union all select 'documents', count(*)::text from public.documents d where d.owner_id = person
  union all select 'practice_sets', count(*)::text from public.practice_sets ps where ps.owner_id = person
  union all select 'briefs', count(*)::text from public.briefs b where b.owner_id = person
  union all select 'uploads', count(*)::text from public.uploads up where up.owner_id = person
  union all select 'problem_reports', count(*)::text from public.problem_reports r where r.owner_id = person;
end;
$$;
revoke execute on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;
