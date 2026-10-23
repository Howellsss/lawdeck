-- Permission tests at database level: the closed pilot (migration 32, Phase 8).
-- While invite-only is on, students without a redeemed code have no questions or scanned pages;
-- codes and pilot counts are for admins only; the price question takes one answer per student.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000601', 'studentA601@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000602', 'studentB602@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000603', 'reviewer603@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000604', 'admin604@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000603';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000604';

-- Before the pilot: everyone has the normal allowance ------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000601');
select test.check((select monthly_limit from public.question_allowance()) = 30, 'outside invite-only mode, students have the normal allowance');
select test.check(public.has_pilot_access(), 'outside invite-only mode, everyone has access');
update public.pilot_settings set invite_only = true;
reset role;
select test.check((select count(*) from public.pilot_settings where not invite_only) = 1, 'students cannot switch invite-only on');
select test.as_user('cccccccc-0000-0000-0000-000000000601');
select test.refused($$insert into public.invite_codes (code, label) values ('ABCDEFGHJK', 'Mine')$$, 'students cannot create invite codes');
reset role;

-- The admin switches invite-only on and creates codes ------------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000604');
update public.pilot_settings set invite_only = true;
insert into public.invite_codes (code, label, max_uses) values ('QUAKKA2345', 'Resit group', 1), ('WAMBAT6789', 'Old code', 5);
update public.invite_codes set disabled = true where code = 'WAMBAT6789';
select test.check((select count(*) from public.invite_codes) = 2, 'admins see the invite codes');
select test.refused($$insert into public.invite_codes (code, label) values ('bad code!', 'x')$$, 'codes must be 10 easy-to-read characters');
reset role;

select test.as_user('cccccccc-0000-0000-0000-000000000601');
select test.check((select monthly_limit from public.question_allowance()) = 0, 'without a code, a student has no questions');
select test.check(public.scan_pages_left() = 0, 'without a code, a student has no scanned pages');
select test.check(not public.has_pilot_access(), 'without a code, a student has no access');
select test.check((select count(*) from public.invite_codes) = 0, 'students cannot see invite codes');
select test.check(public.redeem_invite('NOTACODE00') = 'invalid', 'a wrong code is refused');
select test.check(public.redeem_invite('WAMBAT6789') = 'invalid', 'a disabled code is refused');
select test.check(public.redeem_invite(' quakka2345 ') = 'ok', 'a valid code works, whatever the case and spaces');
select test.check((select monthly_limit from public.question_allowance()) = 30, 'with a code, the student has the normal allowance');
select test.check(public.scan_pages_left() = 200, 'with a code, the student has scanned pages');
select test.check(public.redeem_invite('QUAKKA2345') = 'already', 'redeeming again changes nothing');
select test.refused($$update public.profiles set pilot_access_at = now()$$, 'students cannot give themselves access');
reset role;

select test.as_user('cccccccc-0000-0000-0000-000000000602');
select test.check(public.redeem_invite('QUAKKA2345') = 'used_up', 'a single-use code works only once');
select test.check((select monthly_limit from public.question_allowance()) = 0, 'the second student still has no questions');
reset role;

select test.as_user('dddddddd-0000-0000-0000-000000000603');
select test.check((select unlimited from public.question_allowance()), 'reviewers need no code');
select test.check((select count(*) from public.invite_codes) = 0, 'reviewers cannot see invite codes');
select test.refused($$select * from public.pilot_metrics(6)$$, 'reviewers cannot read the pilot counts');
reset role;

-- The price question ------------------------------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000601');
select test.refused($$insert into public.price_answers (price_ngn, answer) values (2000, 'yes')$$, 'no answers while the question is closed');
reset role;
select test.as_user('eeeeeeee-0000-0000-0000-000000000604');
update public.pilot_settings set price_ngn = 2000, price_question_open = true;
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000601');
insert into public.price_answers (price_ngn, answer) values (2000, 'yes');
select test.refused($$insert into public.price_answers (price_ngn, answer) values (5000, 'yes')$$, 'only the price being asked can be answered');
select test.refused($$insert into public.price_answers (owner_id, price_ngn, answer) values ('cccccccc-0000-0000-0000-000000000602', 2000, 'no')$$,
  'a student cannot answer for someone else');
select test.check((select count(*) from public.price_answers) = 1, 'a student sees their own answer');
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000602');
select test.check((select count(*) from public.price_answers) = 0, 'a student cannot see other answers');
select test.refused($$select * from public.pilot_summary()$$, 'students cannot read the pilot summary');
reset role;

-- The admin's pilot counts ------------------------------------------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000604');
select test.check((select value from public.pilot_summary() where metric = 'price_yes') = 1, 'the admin sees how many said yes');
select test.check((select count(*) from public.pilot_metrics(6) where metric = 'invites_redeemed') = 1, 'the admin sees invites redeemed this week');
delete from public.invite_codes where code = 'QUAKKA2345';
reset role;
select test.check((select count(*) from public.invite_codes where code = 'QUAKKA2345') = 1, 'a used code cannot be deleted');

select test.as_anon();
select test.refused($$select public.redeem_invite('QUAKKA2345')$$, 'visitors cannot redeem codes');
select test.refused($$select count(*) from public.pilot_settings$$, 'visitors cannot read the pilot settings');
reset role;

-- Back to normal for the tests that follow.
update public.pilot_settings set invite_only = false, price_question_open = false;
