-- Permission tests at database level: registered emails and the invite link (migration 36).
-- Only admins see or change the list; a registered person who signs in with Google gets access;
-- someone the invite link was passed on to does not; an email sign-up with a registered address
-- does not count; removing the email takes the access away.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_app_meta_data) values
  ('a5c36002-0000-0000-0000-000000000002', 'friend@test.invalid', '{"provider":"google","providers":["google"]}'),
  ('a5c36003-0000-0000-0000-000000000003', 'bola@test.invalid', '{"provider":"email","providers":["email"]}'),
  ('a5c36004-0000-0000-0000-000000000004', 'admin36@test.invalid', '{"provider":"email","providers":["email"]}'),
  ('a5c36005-0000-0000-0000-000000000005', 'early@test.invalid', '{"provider":"email","providers":["email","google"]}');
update public.profiles set role = 'admin' where id = 'a5c36004-0000-0000-0000-000000000004';
update public.pilot_settings set invite_only = true;

-- Only admins -------------------------------------------------------------------------------
select test.as_user('a5c36002-0000-0000-0000-000000000002');
select test.refused($$select public.add_pilot_emails(array['ada@test.invalid'])$$, 'students cannot register emails');
select test.refused($$select * from public.pilot_email_list()$$, 'students cannot see the registered emails');
select test.refused($$select * from public.pilot_emails$$, 'students cannot read the table directly');
select test.refused($$insert into public.pilot_emails (email) values ('ada@test.invalid')$$, 'students cannot add to the table directly');
select test.check(public.claim_pilot_invite() = 'not_registered', 'before the admin registers them, a student is told they are not registered');
select test.check(not public.has_pilot_access(), 'and has no access');
reset role;

-- The admin registers emails ------------------------------------------------------------------
select test.as_user('a5c36004-0000-0000-0000-000000000004');
select test.check(public.add_pilot_emails(array[' Ada@Test.invalid ', 'bola@test.invalid', 'early@test.invalid', 'ada@test.invalid']) = 3,
  'the admin registers three emails (tidied, without repeats)');
select test.check(public.add_pilot_emails(array['bola@test.invalid']) = 0, 'registering an email twice adds nothing');
select test.refused($$select public.add_pilot_emails(array['not an email'])$$, 'something that is not an email is refused');
select test.refused($$select public.add_pilot_emails(array[]::text[])$$, 'an empty list is refused');
select test.check((select count(*) from public.pilot_email_list()) = 3, 'the admin sees the list');
select test.check((select joined from public.pilot_email_list() where email = 'early@test.invalid'),
  'someone who had already signed in with Google gets access as soon as they are registered');
select test.check(not (select joined from public.pilot_email_list() where email = 'ada@test.invalid'), 'others have not joined yet');
reset role;
select test.check((select count(*) from public.audit_log where action = 'pilot_emails_added') = 2, 'registering emails is recorded in the audit log');

-- Following the invite link: Ada signs in with Google for the first time -------------------------
insert into auth.users (id, email, raw_app_meta_data) values
  ('a5c36001-0000-0000-0000-000000000001', 'ada@test.invalid', '{"provider":"google","providers":["google"]}');
select test.as_user('a5c36001-0000-0000-0000-000000000001');
select test.check(public.claim_pilot_invite() = 'ok', 'a registered person signed in with Google gets in');
select test.check(public.has_pilot_access(), 'and now has access');
select test.check(public.claim_pilot_invite() = 'ok', 'signing in again changes nothing');
reset role;

select test.as_user('a5c36002-0000-0000-0000-000000000002');
select test.check(public.claim_pilot_invite() = 'not_registered', 'someone the link was passed on to is told their email is not registered');
select test.check(not public.has_pilot_access(), 'and has no access');
reset role;

select test.as_user('a5c36003-0000-0000-0000-000000000003');
select test.check(public.claim_pilot_invite() = 'use_google', 'an email sign-up with a registered address is asked to use Google');
select test.check(not public.has_pilot_access(), 'and has no access until then');
reset role;

-- Removing an email ---------------------------------------------------------------------------
select test.as_user('a5c36001-0000-0000-0000-000000000001');
select test.refused($$select public.remove_pilot_email((select id from public.pilot_emails limit 1))$$, 'students cannot remove emails');
reset role;
select test.as_user('a5c36004-0000-0000-0000-000000000004');
select test.check(public.remove_pilot_email((select id from public.pilot_email_list() where email = 'ada@test.invalid')) = 'ok', 'the admin removes an email');
select test.check(public.remove_pilot_email(gen_random_uuid()) = 'not_found', 'an unknown entry is reported');
reset role;
select test.as_user('a5c36001-0000-0000-0000-000000000001');
select test.check(not public.has_pilot_access(), 'removing the email takes the access away');
select test.check(public.claim_pilot_invite() = 'not_registered', 'and the invite link no longer lets them in');
reset role;

-- With invite-only off, everyone is in ---------------------------------------------------------
update public.pilot_settings set invite_only = false;
select test.as_user('a5c36002-0000-0000-0000-000000000002');
select test.check(public.claim_pilot_invite() = 'open', 'with invite-only off, the invite link simply lets people in');
reset role;
select test.as_anon();
select test.refused($$select public.claim_pilot_invite()$$, 'visitors who are not signed in cannot claim access');
reset role;

delete from public.audit_log where action in ('pilot_emails_added', 'pilot_email_removed', 'pilot_invite_claimed');
delete from public.pilot_emails;
delete from auth.users where id::text like 'a5c3600%';
