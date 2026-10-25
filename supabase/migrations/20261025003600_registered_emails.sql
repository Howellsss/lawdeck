-- Lawdeck migration 36: registered emails and the invite link (founder, 2026-10-25).
-- While invite-only is on, the admin registers each tester's email on the Pilot page and sends them
-- the invite link. A registered person who signs in with Google gets access automatically; anyone
-- else (for example someone the link was passed on to) is told their email is not registered.
-- 1. pilot_emails: the registered emails. Admins only, through the functions below.
-- 2. add_pilot_emails(list) and remove_pilot_email(id): admins only, recorded in audit_log.
--    Adding gives access at once to someone who already signed in with Google with that email;
--    removing takes away the access the email gave.
-- 3. pilot_email_list(): the list for the Pilot page, with whether each person has joined.
-- 4. claim_pilot_invite(): run at every sign-in and on the invite page; gives a registered person
--    access. Only a Google sign-in counts, because Google has checked that the email is theirs
--    (email sign-up does not ask people to confirm their email).

-- ---------------------------------------------------------------------------
-- 1. The registered emails.
create table public.pilot_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
    check (email = lower(email) and char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.pilot_emails enable row level security;
-- Nobody reads or changes the table directly; the admin functions below do.
revoke all on public.pilot_emails from anon, authenticated;

-- Whether a person signed in with Google using this email.
create function public.signed_in_with_google(u auth.users)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(u.raw_app_meta_data -> 'providers' ? 'google', false)
      or u.raw_app_meta_data ->> 'provider' = 'google';
$$;
revoke execute on function public.signed_in_with_google(auth.users) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Adding and removing emails.
create function public.add_pilot_emails(emails text[])
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
  with new_rows as (
    insert into public.pilot_emails (email, added_by)
    select distinct lower(trim(e)), (select auth.uid()) from unnest(emails) e
    on conflict (email) do nothing
    returning email
  )
  select count(*) into added from new_rows;
  -- Someone who already signed in with Google with one of these emails gets access now.
  update public.profiles pr
     set pilot_access_at = now()
    from auth.users u
   where u.id = pr.id and pr.pilot_access_at is null and public.signed_in_with_google(u)
     and lower(u.email) in (select lower(trim(e)) from unnest(emails) e);
  insert into public.audit_log (actor_id, action, target_type)
  values ((select auth.uid()), 'pilot_emails_added', 'pilot_email');
  return added;
end;
$$;
revoke execute on function public.add_pilot_emails(text[]) from public, anon;
grant execute on function public.add_pilot_emails(text[]) to authenticated;

create function public.remove_pilot_email(entry uuid)
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
  -- The access this email gave goes with it (reviewers and admins never need it).
  update public.profiles pr
     set pilot_access_at = null
    from auth.users u
   where u.id = pr.id and lower(u.email) = removed and pr.role = 'student';
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values ((select auth.uid()), 'pilot_email_removed', 'pilot_email', entry);
  return 'ok';
end;
$$;
revoke execute on function public.remove_pilot_email(uuid) from public, anon;
grant execute on function public.remove_pilot_email(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The list for the Pilot page, newest first.
create function public.pilot_email_list()
returns table (id uuid, email text, created_at timestamptz, joined boolean)
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
    select e.id, e.email, e.created_at,
           exists (select 1 from auth.users u join public.profiles pr on pr.id = u.id
                    where lower(u.email) = e.email and pr.pilot_access_at is not null)
      from public.pilot_emails e
     order by e.created_at desc;
end;
$$;
revoke execute on function public.pilot_email_list() from public, anon;
grant execute on function public.pilot_email_list() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Claiming access: 'open' (invite-only is off), 'ok' (access given or already there),
-- 'use_google' (registered, but signed in another way) or 'not_registered'.
create function public.claim_pilot_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  person auth.users%rowtype;
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
  select * into person from auth.users u where u.id = me;
  if not exists (select 1 from public.pilot_emails e where e.email = lower(person.email)) then
    return 'not_registered';
  end if;
  if not public.signed_in_with_google(person) then
    return 'use_google';
  end if;
  update public.profiles set pilot_access_at = now() where id = me and pilot_access_at is null;
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (me, 'pilot_invite_claimed', 'profile', me);
  return 'ok';
end;
$$;
revoke execute on function public.claim_pilot_invite() from public, anon;
grant execute on function public.claim_pilot_invite() to authenticated;
