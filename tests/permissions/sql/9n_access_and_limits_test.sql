-- Permission tests at database level: giving access from the Users page, and the public-test
-- limits (migration 35). Only admins give or remove access or set limits; reviewers and admins are
-- never limited; the burst window and the monthly cap count every kind of AI request.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c35001-0000-0000-0000-000000000001', 'waiting@test.invalid'),
  ('a5c35002-0000-0000-0000-000000000002', 'other@test.invalid'),
  ('a5c35003-0000-0000-0000-000000000003', 'reviewer35@test.invalid'),
  ('a5c35004-0000-0000-0000-000000000004', 'admin35@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a5c35003-0000-0000-0000-000000000003';
update public.profiles set role = 'admin' where id = 'a5c35004-0000-0000-0000-000000000004';
update public.pilot_settings set invite_only = true;

-- Giving access ---------------------------------------------------------------------------
select test.as_user('a5c35001-0000-0000-0000-000000000001');
select test.check((select monthly_limit from public.question_allowance()) = 0, 'a student waiting for access has no questions');
select test.refused($$select public.set_pilot_access('a5c35001-0000-0000-0000-000000000001', true)$$, 'students cannot give themselves access');
reset role;

select test.as_user('a5c35003-0000-0000-0000-000000000003');
select test.refused($$select public.set_pilot_access('a5c35001-0000-0000-0000-000000000001', true)$$, 'reviewers cannot give access');
reset role;

select test.as_user('a5c35004-0000-0000-0000-000000000004');
select test.check(public.set_pilot_access('a5c35001-0000-0000-0000-000000000001', true) = 'ok', 'the admin gives a student access');
select test.check(public.set_pilot_access('a5c35001-0000-0000-0000-000000000001', true) = 'ok', 'giving access twice changes nothing');
select test.check(public.set_pilot_access(gen_random_uuid(), true) = 'not_found', 'an unknown person is reported, not created');
reset role;
select test.check(
  (select count(*) from public.audit_log where action = 'pilot_access_given' and target_id = 'a5c35001-0000-0000-0000-000000000001') = 2,
  'giving access is recorded in the audit log');

select test.as_user('a5c35001-0000-0000-0000-000000000001');
select test.check(public.has_pilot_access(), 'the student now has access');
select test.check((select monthly_limit from public.question_allowance()) = 30, 'the student has the normal allowance');
reset role;
select test.as_user('a5c35002-0000-0000-0000-000000000002');
select test.check(not public.has_pilot_access(), 'other students are still waiting');
reset role;

-- Limits for a public test ----------------------------------------------------------------
select test.as_user('a5c35001-0000-0000-0000-000000000001');
update public.pilot_settings set burst_limit = 50, burst_hours = 1;
reset role;
select test.check((select burst_limit from public.pilot_settings) is null, 'students cannot change the limits');

select test.as_user('a5c35004-0000-0000-0000-000000000004');
select test.refused($$update public.pilot_settings set burst_limit = 5$$, 'a burst limit needs its hours too');
update public.pilot_settings set burst_limit = 5, burst_hours = 3, monthly_question_cap = 25, monthly_scan_page_cap = 20;
reset role;

-- Four requests 4 hours ago (outside the window) and five in the last hour.
insert into public.usage_events (owner_id, kind, created_at)
  select 'a5c35001-0000-0000-0000-000000000001', 'explain', now() - interval '4 hours' from generate_series(1, 4);
insert into public.usage_events (owner_id, kind, created_at)
  select 'a5c35001-0000-0000-0000-000000000001', k, now() - interval '50 minutes'
    from unnest(array['explain', 'practice', 'brief', 'marking', 'draft']) k;

select test.as_user('a5c35001-0000-0000-0000-000000000001');
select test.check((select monthly_limit from public.question_allowance()) = 25, 'the monthly cap replaces the plan''s 30');
select test.check((select window_limit from public.question_allowance()) = 5, 'the burst limit is reported');
select test.check((select window_used from public.question_allowance()) = 5, 'every kind of AI request counts in the window; older ones do not');
select test.check(
  (select window_resets_at from public.question_allowance()) between now() + interval '2 hours' and now() + interval '2 hours 20 minutes',
  'the window frees up 3 hours after the oldest request in it');
select test.check(public.scan_pages_left() = 20, 'the scan cap replaces the plan''s 200 pages');
reset role;

select test.as_user('a5c35003-0000-0000-0000-000000000003');
select test.check((select unlimited from public.question_allowance()), 'reviewers are never limited');
select test.check((select window_limit from public.question_allowance()) is null, 'reviewers have no burst window');
reset role;

-- Removing access ---------------------------------------------------------------------------
select test.as_user('a5c35004-0000-0000-0000-000000000004');
select test.check(public.set_pilot_access('a5c35001-0000-0000-0000-000000000001', false) = 'ok', 'the admin removes access');
reset role;
select test.as_user('a5c35001-0000-0000-0000-000000000001');
select test.check(not public.has_pilot_access(), 'the student no longer has access');
select test.check((select monthly_limit from public.question_allowance()) = 0, 'and has no questions');
reset role;

select test.as_anon();
select test.refused($$select public.set_pilot_access('a5c35001-0000-0000-0000-000000000001', true)$$, 'visitors cannot give access');
select test.refused($$select * from public.question_allowance()$$, 'visitors have no allowance');
reset role;

-- Back to normal for the tests that follow.
update public.pilot_settings
   set invite_only = false, burst_limit = null, burst_hours = null, monthly_question_cap = null, monthly_scan_page_cap = null;
