-- Lawdeck migration 43: access that ends by itself (founder, 2026-11-02: "adding a few new students
-- today ... 3 days duration and turn off afterwards automatically").
-- 1. profiles.pilot_access_until: when a person's access ends (empty = no end). has_pilot_access()
--    checks it on every request, so access stops at that moment with no job to run.
-- 2. pilot_emails.access_days: how long access lasts for someone registered by email (1–90 days,
--    empty = no end), counted from when they first get in. Registering an email again renews it.
-- 3. set_pilot_access(person, allow, days): giving access from the Users page can also set days.
-- 4. claim_pilot_invite() says 'ended' when a person's access has run out, instead of 'ok'.
-- 5. pilot_email_list() also returns each email's days and when that person's access ends.
-- Old calls keep working: the new day arguments are optional.

-- ---------------------------------------------------------------------------
-- 1. When access ends.
alter table public.profiles add column pilot_access_until timestamptz;
alter table public.pilot_emails add column access_days integer check (access_days between 1 and 90);

create or replace function public.has_pilot_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    not coalesce((select s.invite_only from public.pilot_settings s where s.id), false)
    or public.is_reviewer()
    or exists (
      select 1 from public.profiles pr
       where pr.id = (select auth.uid()) and pr.pilot_access_at is not null
         and (pr.pilot_access_until is null or pr.pilot_access_until > now())
    )
  );
$$;

-- The signed-in person's own access end, for their Account page and home page note.
create function public.own_access_until()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select pr.pilot_access_until from public.profiles pr where pr.id = (select auth.uid());
$$;
revoke execute on function public.own_access_until() from public, anon;
grant execute on function public.own_access_until() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Registering emails, with optional days.
drop function public.add_pilot_emails(text[]);
create function public.add_pilot_emails(emails text[], days integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if emails is null or cardinality(emails) = 0 or cardinality(emails) > 50 then
    raise exception 'Add between 1 and 50 emails at a time.' using errcode = 'check_violation';
  end if;
  if days is not null and (days < 1 or days > 90) then
    raise exception 'Access lasts between 1 and 90 days.' using errcode = 'check_violation';
  end if;
  -- A new email is added; one already on the list takes the new number of days (a renewal).
  with rows as (
    insert into public.pilot_emails (email, added_by, access_days)
    select distinct lower(trim(e)), (select auth.uid()), days from unnest(emails) e
    on conflict (email) do update set access_days = excluded.access_days
    returning email, (xmax = 0) as is_new
  )
  select count(*) filter (where is_new) into added from rows;
  -- Someone who already signed in with Google with one of these emails gets (or renews) access now.
  update public.profiles pr
     set pilot_access_at = case
           when pr.pilot_access_at is null or (pr.pilot_access_until is not null and pr.pilot_access_until <= now()) then now()
           else pr.pilot_access_at end,
         pilot_access_until = case when days is null then null else now() + make_interval(days => days) end
    from auth.users u
   where u.id = pr.id and pr.role = 'student' and public.signed_in_with_google(u)
     and lower(u.email) in (select lower(trim(e)) from unnest(emails) e);
  insert into public.audit_log (actor_id, action, target_type)
  values ((select auth.uid()), 'pilot_emails_added', 'pilot_email');
  return added;
end;
$$;
revoke execute on function public.add_pilot_emails(text[], integer) from public, anon;
grant execute on function public.add_pilot_emails(text[], integer) to authenticated;

-- Removing an email also clears the end date with the access.
create or replace function public.remove_pilot_email(entry uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed text;
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  delete from public.pilot_emails where id = entry returning email into removed;
  if removed is null then
    return 'not_found';
  end if;
  update public.profiles pr
     set pilot_access_at = null, pilot_access_until = null
    from auth.users u
   where u.id = pr.id and lower(u.email) = removed and pr.role = 'student';
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values ((select auth.uid()), 'pilot_email_removed', 'pilot_email', entry);
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Giving access from the Users page, with optional days.
drop function public.set_pilot_access(uuid, boolean);
create function public.set_pilot_access(person uuid, allow boolean, days integer default null)
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
  if days is not null and (days < 1 or days > 90) then
    raise exception 'Access lasts between 1 and 90 days.' using errcode = 'check_violation';
  end if;
  update public.profiles pr
     set pilot_access_at = case
           when not allow then null
           when pr.pilot_access_at is null or (pr.pilot_access_until is not null and pr.pilot_access_until <= now()) then now()
           else pr.pilot_access_at end,
         pilot_access_until = case when allow and days is not null then now() + make_interval(days => days) else null end
   where pr.id = person;
  if not found then
    return 'not_found';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values ((select auth.uid()), case when allow then 'pilot_access_given' else 'pilot_access_removed' end, 'profile', person);
  return 'ok';
end;
$$;
revoke execute on function public.set_pilot_access(uuid, boolean, integer) from public, anon;
grant execute on function public.set_pilot_access(uuid, boolean, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Claiming access through the invite link: 'ended' once the days have run out.
create or replace function public.claim_pilot_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  person auth.users%rowtype;
  days integer;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if not coalesce((select s.invite_only from public.pilot_settings s where s.id), false) then
    return 'open';
  end if;
  if public.has_pilot_access() then
    return 'ok';
  end if;
  if exists (select 1 from public.profiles pr where pr.id = me and pr.pilot_access_at is not null
              and pr.pilot_access_until is not null and pr.pilot_access_until <= now()) then
    return 'ended';
  end if;
  select * into person from auth.users u where u.id = me;
  select e.access_days into days from public.pilot_emails e where e.email = lower(person.email);
  if not found then
    return 'not_registered';
  end if;
  if not public.signed_in_with_google(person) then
    return 'use_google';
  end if;
  update public.profiles
     set pilot_access_at = now(),
         pilot_access_until = case when days is null then null else now() + make_interval(days => days) end
   where id = me and pilot_access_at is null;
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (me, 'pilot_invite_claimed', 'profile', me);
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The Pilot page list, with days and each person's end date.
drop function public.pilot_email_list();
create function public.pilot_email_list()
returns table (id uuid, email text, created_at timestamptz, joined boolean, access_days integer, access_until timestamptz)
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
    select e.id, e.email, e.created_at, p.pilot_access_at is not null, e.access_days, p.pilot_access_until
      from public.pilot_emails e
      left join lateral (
        select pr.pilot_access_at, pr.pilot_access_until
          from auth.users u join public.profiles pr on pr.id = u.id
         where lower(u.email) = e.email
         limit 1
      ) p on true
     order by e.created_at desc;
end;
$$;
revoke execute on function public.pilot_email_list() from public, anon;
grant execute on function public.pilot_email_list() to authenticated;
