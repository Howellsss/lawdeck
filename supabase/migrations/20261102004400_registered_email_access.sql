-- Lawdeck migration 44: a registered email gets access however the person signs in (founder,
-- 2026-11-02: "so long as their emails have been added, they should get express access").
-- Until now only a Google sign-in counted, because email sign-ups were not confirmed at the time
-- (migration 36). Email sign-up now requires confirming the email (Supabase "Confirm email" is on,
-- docs/specs/sign-in.md), so a confirmed email proves the person owns it just as Google does.
-- 1. email_verified(user): signed in with Google, or the email has been confirmed.
-- 2. add_pilot_emails and claim_pilot_invite use it instead of the Google-only check.
-- 'use_google' is still returned for an unconfirmed email (Supabase does not let those sign in).

-- ---------------------------------------------------------------------------
-- 1. Whether the person has proved the email is theirs.
create function public.email_verified(u auth.users)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.signed_in_with_google(u) or u.email_confirmed_at is not null;
$$;
revoke execute on function public.email_verified(auth.users) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Registering emails.
create or replace function public.add_pilot_emails(emails text[], days integer default null)
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
  -- Someone who already has a verified account with one of these emails gets (or renews) access now.
  update public.profiles pr
     set pilot_access_at = case
           when pr.pilot_access_at is null or (pr.pilot_access_until is not null and pr.pilot_access_until <= now()) then now()
           else pr.pilot_access_at end,
         pilot_access_until = case when days is null then null else now() + make_interval(days => days) end
    from auth.users u
   where u.id = pr.id and pr.role = 'student' and public.email_verified(u)
     and lower(u.email) in (select lower(trim(e)) from unnest(emails) e);
  insert into public.audit_log (actor_id, action, target_type)
  values ((select auth.uid()), 'pilot_emails_added', 'pilot_email');
  return added;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Claiming access (run at every sign-in and whenever a student without access opens Lawdeck).
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
  if not public.email_verified(person) then
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

