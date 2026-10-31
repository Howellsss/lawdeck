-- Lawdeck migration 42: one Users dashboard (founder, 2026-10-31: "have everything in one place ...
-- paid or free, when joined, questions asked, amount used"). The people list now also gives each
-- person's AI cost this month (Lagos time) and can be sorted by newest, highest cost, most questions
-- or most recently active. Admins only, as before; costs and counts, never question text.

drop function public.admin_users(text, text, text, integer, integer);

create function public.admin_users(
  search text default null,
  plan_name text default null,
  payment text default null,
  page_size integer default 50,
  page_offset integer default 0,
  sort text default 'newest'
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
  cost_this_month numeric,
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
  if sort is null or sort not in ('newest', 'cost', 'questions', 'active') then
    raise exception 'Unknown sort.' using errcode = '22023';
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
  ),
  used as (
    select m.*,
           (select count(*)::integer from public.usage_events e
             where e.owner_id = m.id and e.kind in ('explain', 'practice', 'brief', 'marking', 'draft') and e.created_at >= month_start) as questions,
           (select round(coalesce(sum(e.cost_usd), 0), 4) from public.usage_events e
             where e.owner_id = m.id and e.created_at >= month_start) as cost,
           (select max(e.created_at) from public.usage_events e where e.owner_id = m.id) as active
      from matched m
  )
  select x.id, x.email, x.full_name, x.role, x.joined_at, x.last_sign_in_at, x.email_confirmed, x.sign_in_method,
         x.plan, x.payment_status,
         (select s.period_end from public.subscriptions s
           where s.owner_id = x.id and s.status = 'active' order by s.created_at desc limit 1),
         x.pilot_access, x.questions, x.cost, x.active,
         count(*) over ()
    from used x
   order by
     case when admin_users.sort = 'cost' then x.cost end desc nulls last,
     case when admin_users.sort = 'questions' then x.questions end desc nulls last,
     case when admin_users.sort = 'active' then x.active end desc nulls last,
     x.joined_at desc, x.id
   limit page_size offset page_offset;
end;
$$;
revoke execute on function public.admin_users(text, text, text, integer, integer, text) from public, anon;
grant execute on function public.admin_users(text, text, text, integer, integer, text) to authenticated;
