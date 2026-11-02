-- Permission tests at database level: access that ends by itself (migration 43).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_app_meta_data) values
  ('a5c43001-0000-0000-0000-000000000001', 'admin43@test.invalid', '{"provider":"email","providers":["email"]}'),
  ('a5c43002-0000-0000-0000-000000000002', 'early43@test.invalid', '{"provider":"google","providers":["google"]}'),
  ('a5c43004-0000-0000-0000-000000000004', 'given43@test.invalid', '{"provider":"email","providers":["email"]}');
update public.profiles set role = 'admin' where id = 'a5c43001-0000-0000-0000-000000000001';
update public.pilot_settings set invite_only = true;

-- The admin registers two emails for 3 days ---------------------------------------------------
select test.as_user('a5c43001-0000-0000-0000-000000000001');
select test.check(public.add_pilot_emails(array['early43@test.invalid', 'late43@test.invalid'], 3) = 2, 'the admin registers emails for 3 days');
select test.refused($$select public.add_pilot_emails(array['x43@test.invalid'], 91)$$, 'more than 90 days is refused');
select test.refused($$select public.add_pilot_emails(array['x43@test.invalid'], 0)$$, 'zero days is refused');
select test.check((select access_days from public.pilot_email_list() where email = 'early43@test.invalid') = 3, 'the list shows the days');
select test.check((select access_until between now() + interval '71 hours' and now() + interval '73 hours'
                     from public.pilot_email_list() where email = 'early43@test.invalid'),
  'someone already signed in with Google gets access ending in 3 days');
reset role;

-- A registered student joins through the invite link -------------------------------------------
insert into auth.users (id, email, raw_app_meta_data) values
  ('a5c43003-0000-0000-0000-000000000003', 'late43@test.invalid', '{"provider":"google","providers":["google"]}');
select test.as_user('a5c43003-0000-0000-0000-000000000003');
select test.check(public.claim_pilot_invite() = 'ok', 'the student gets in');
select test.check(public.has_pilot_access(), 'and has access');
select test.check(public.own_access_until() between now() + interval '71 hours' and now() + interval '73 hours',
  'their access ends 3 days after they first got in');
reset role;

-- Three days later ------------------------------------------------------------------------------
update public.profiles set pilot_access_until = now() - interval '1 minute' where id = 'a5c43003-0000-0000-0000-000000000003';
select test.as_user('a5c43003-0000-0000-0000-000000000003');
select test.check(not public.has_pilot_access(), 'access stops by itself when the days run out');
select test.check(public.claim_pilot_invite() = 'ended', 'signing in again says the access has ended, not ok');
select test.check(not public.has_pilot_access(), 'and does not give access again');
reset role;

-- The admin renews by registering the email again -------------------------------------------------
select test.as_user('a5c43001-0000-0000-0000-000000000001');
select test.check(public.add_pilot_emails(array['late43@test.invalid'], 2) = 0, 'registering again renews instead of adding');
reset role;
select test.as_user('a5c43003-0000-0000-0000-000000000003');
select test.check(public.has_pilot_access(), 'the renewed student has access again');
select test.check(public.own_access_until() between now() + interval '47 hours' and now() + interval '49 hours', 'for the new number of days');
reset role;

-- Giving access from the Users page, with and without days -------------------------------------
select test.as_user('a5c43001-0000-0000-0000-000000000001');
select test.check(public.set_pilot_access('a5c43004-0000-0000-0000-000000000004', true, 3) = 'ok', 'the admin gives access for 3 days');
reset role;
select test.check((select pilot_access_until > now() + interval '71 hours' from public.profiles where id = 'a5c43004-0000-0000-0000-000000000004'),
  'that access has an end');
select test.as_user('a5c43001-0000-0000-0000-000000000001');
select test.check(public.set_pilot_access('a5c43004-0000-0000-0000-000000000004', true) = 'ok', 'giving access without days');
reset role;
select test.check((select pilot_access_until is null from public.profiles where id = 'a5c43004-0000-0000-0000-000000000004'),
  'means no end');
select test.as_user('a5c43001-0000-0000-0000-000000000001');
select test.check(public.set_pilot_access('a5c43004-0000-0000-0000-000000000004', false) = 'ok', 'removing access');
reset role;
select test.check((select pilot_access_at is null and pilot_access_until is null from public.profiles where id = 'a5c43004-0000-0000-0000-000000000004'),
  'clears both');

-- Only admins ------------------------------------------------------------------------------------
select test.as_user('a5c43003-0000-0000-0000-000000000003');
select test.refused($$select public.set_pilot_access('a5c43003-0000-0000-0000-000000000003', true, 90)$$, 'a student cannot extend their own access');
select test.refused($$update public.profiles set pilot_access_until = null where id = 'a5c43003-0000-0000-0000-000000000003'$$,
  'a student cannot clear their own end date');
reset role;
update public.pilot_settings set invite_only = false;
