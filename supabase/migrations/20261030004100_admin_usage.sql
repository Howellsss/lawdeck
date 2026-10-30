-- Lawdeck migration 41: usage and cost per person for admins (founder, 2026-10-30: "a space in the
-- users section that shows me each user's usage level and cost ... what they're researching").
-- Reads usage_events (one row per AI call: kind, model, cost; never the question or answer) and
-- counts of chats and questions per course. Never the text of a question, answer or document.
-- Every function refuses anyone who is not an admin.

-- ---------------------------------------------------------------------------
-- 1. Everyone who used Lawdeck in the last `days` days, highest AI cost first.
create function public.admin_usage_ranking(days integer default 30)
returns table (
  id uuid,
  email text,
  full_name text,
  role public.app_role,
  calls integer,
  questions integer,
  cost_usd numeric,
  last_active_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if days is null or days < 1 or days > 366 then
    raise exception 'Days must be 1 to 366.' using errcode = '22023';
  end if;
  return query
  select u.id, u.email::text,
         coalesce(nullif(trim(pr.full_name), ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         pr.role,
         count(*)::integer,
         (count(*) filter (where e.kind in ('explain', 'practice', 'brief', 'marking', 'draft')))::integer,
         round(coalesce(sum(e.cost_usd), 0), 4),
         max(e.created_at)
    from public.usage_events e
    join auth.users u on u.id = e.owner_id
    join public.profiles pr on pr.id = e.owner_id
   where e.created_at >= now() - make_interval(days => admin_usage_ranking.days)
   group by u.id, u.email, pr.full_name, u.raw_user_meta_data, pr.role
   order by 7 desc, 6 desc, u.id
   limit 500;
end;
$$;
revoke execute on function public.admin_usage_ranking(integer) from public, anon;
grant execute on function public.admin_usage_ranking(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. One person's AI use by kind: calls and cost this month (Lagos time), the last 30 days and ever.
create function public.admin_user_usage(person uuid)
returns table (kind text, calls_month integer, cost_month numeric, calls_30d integer, cost_30d numeric, calls_total integer, cost_total numeric)
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
  return query
  select e.kind,
         (count(*) filter (where e.created_at >= month_start))::integer,
         round(coalesce(sum(e.cost_usd) filter (where e.created_at >= month_start), 0), 4),
         (count(*) filter (where e.created_at >= now() - interval '30 days'))::integer,
         round(coalesce(sum(e.cost_usd) filter (where e.created_at >= now() - interval '30 days'), 0), 4),
         count(*)::integer,
         round(coalesce(sum(e.cost_usd), 0), 4)
    from public.usage_events e
   where e.owner_id = person
   group by e.kind
   order by 7 desc;
end;
$$;
revoke execute on function public.admin_user_usage(uuid) from public, anon;
grant execute on function public.admin_user_usage(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. One person's cost and calls per day (Lagos dates) for the last `days` days, days with no use included.
create function public.admin_user_usage_daily(person uuid, days integer default 30)
returns table (day date, calls integer, cost_usd numeric)
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
  if days is null or days < 1 or days > 90 then
    raise exception 'Days must be 1 to 90.' using errcode = '22023';
  end if;
  return query
  select d::date,
         count(e.id)::integer,
         round(coalesce(sum(e.cost_usd), 0), 4)
    from generate_series(today - (days - 1), today, interval '1 day') d
    left join public.usage_events e
      on e.owner_id = person and (e.created_at at time zone 'Africa/Lagos')::date = d::date
   group by d
   order by d;
end;
$$;
revoke execute on function public.admin_user_usage_daily(uuid, integer) from public, anon;
grant execute on function public.admin_user_usage_daily(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. What one person studies: chats and questions asked per course (counts only, no question text).
-- Chats asked across all courses show as "All courses".
create function public.admin_user_courses(person uuid)
returns table (course text, chats integer, questions integer, last_asked_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  return query
  select coalesce(co.name, 'All courses'),
         count(distinct c.id)::integer,
         (count(m.id) filter (where m.role = 'user'))::integer,
         max(m.created_at) filter (where m.role = 'user')
    from public.conversations c
    left join public.courses co on co.id = c.course_id
    left join public.messages m on m.conversation_id = c.id
   where c.owner_id = person
   group by co.name
   order by 3 desc, 1;
end;
$$;
revoke execute on function public.admin_user_courses(uuid) from public, anon;
grant execute on function public.admin_user_courses(uuid) to authenticated;
