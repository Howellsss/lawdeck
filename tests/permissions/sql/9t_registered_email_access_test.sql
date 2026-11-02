-- Permission tests at database level: a registered email gets access however the person signs in,
-- as long as they have proved the email is theirs (migration 44).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_app_meta_data, email_confirmed_at) values
  ('a5c44001-0000-0000-0000-000000000001', 'admin44@test.invalid', '{"provider":"email","providers":["email"]}', now()),
  ('a5c44002-0000-0000-0000-000000000002', 'confirmed44@test.invalid', '{"provider":"email","providers":["email"]}', now()),
  ('a5c44003-0000-0000-0000-000000000003', 'unconfirmed44@test.invalid', '{"provider":"email","providers":["email"]}', null),
  ('a5c44004-0000-0000-0000-000000000004', 'already44@test.invalid', '{"provider":"email","providers":["email"]}', now()),
  ('a5c44005-0000-0000-0000-000000000005', 'stranger44@test.invalid', '{"provider":"email","providers":["email"]}', now());
update public.profiles set role = 'admin' where id = 'a5c44001-0000-0000-0000-000000000001';
update public.pilot_settings set invite_only = true;

select test.as_user('a5c44001-0000-0000-0000-000000000001');
select test.check(public.add_pilot_emails(array['confirmed44@test.invalid', 'unconfirmed44@test.invalid'], 3) = 2, 'the admin registers two emails');
reset role;

-- A confirmed email sign-up gets in without Google --------------------------------------------
select test.as_user('a5c44002-0000-0000-0000-000000000002');
select test.check(public.claim_pilot_invite() = 'ok', 'a registered, confirmed email sign-up gets in');
select test.check(public.has_pilot_access(), 'and has access');
select test.check(public.own_access_until() between now() + interval '71 hours' and now() + interval '73 hours', 'for the registered days');
reset role;

-- An email nobody has confirmed still does not count -------------------------------------------
select test.as_user('a5c44003-0000-0000-0000-000000000003');
select test.check(public.claim_pilot_invite() = 'use_google', 'an unconfirmed email is not enough');
select test.check(not public.has_pilot_access(), 'and gives no access');
reset role;

-- Registering someone who already has a confirmed account gives access at once ---------------------
select test.as_user('a5c44001-0000-0000-0000-000000000001');
select test.check(public.add_pilot_emails(array['already44@test.invalid']) = 1, 'the admin registers an existing account');
reset role;
select test.as_user('a5c44004-0000-0000-0000-000000000004');
select test.check(public.has_pilot_access(), 'they have access straight away');
reset role;

-- People who are not registered still get nothing -------------------------------------------------
select test.as_user('a5c44005-0000-0000-0000-000000000005');
select test.check(public.claim_pilot_invite() = 'not_registered', 'a confirmed email that is not registered gets no access');
select test.check(not public.has_pilot_access(), 'and has none');
select test.refused($$select public.email_verified(u) from auth.users u limit 1$$, 'students cannot call the check directly');
reset role;
