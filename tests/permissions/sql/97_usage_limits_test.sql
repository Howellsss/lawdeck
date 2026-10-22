-- Permission tests at database level: AI usage records and the monthly question limit (migration 14).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000141', 'student141@test.invalid'),
  ('bbbbbbbb-0000-0000-0000-000000000142', 'student142@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000143', 'reviewer143@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000143';

select test.check((select monthly_message_limit from public.plans where name = 'Free') = 30, 'the Free plan allows 30 questions a month');

-- A student on no plan is on Free, with nothing used yet --------------------------------
select test.as_user('aaaaaaaa-0000-0000-0000-000000000141');
select test.check(
  (select used = 0 and monthly_limit = 30 and not unlimited from public.question_allowance()),
  'a new student has 30 questions this month');

-- Recording usage -------------------------------------------------------------------------
select public.record_ai_usage('explain', 'claude-sonnet-5-5', 1200, 300, 0.0054, 2100);
select public.record_ai_usage('route', 'claude-haiku-5-5', 80, 2, 0.00001, 300);
select test.check((select count(*) from public.usage_events) = 2, 'the server records each AI call for the student');
select test.check((select used from public.question_allowance()) = 1, 'only answers count as questions, not routing');
select test.refused(
  $$insert into public.usage_events (owner_id, kind) values ('bbbbbbbb-0000-0000-0000-000000000142', 'explain')$$,
  'a student cannot write usage records directly');
select test.refused($$delete from public.usage_events$$, 'a student cannot delete their usage to get round the limit');
select test.refused($$update public.usage_events set kind = 'route'$$, 'a student cannot change their usage to get round the limit');
reset role;

-- Usage is always the signed-in person's own --------------------------------------------
select test.check(
  (select count(*) from public.usage_events where owner_id = 'aaaaaaaa-0000-0000-0000-000000000141') = 2
  and (select count(*) from public.usage_events where owner_id = 'bbbbbbbb-0000-0000-0000-000000000142') = 0,
  'usage is recorded against the signed-in student only');
select test.as_user('bbbbbbbb-0000-0000-0000-000000000142');
select test.check((select count(*) from public.usage_events) = 0, 'a student cannot see another student''s usage');
select test.check((select used from public.question_allowance()) = 0, 'one student''s questions do not count against another');
reset role;

-- Last month's questions do not count; this month's do -------------------------------------
insert into public.usage_events (owner_id, kind, created_at)
  select 'aaaaaaaa-0000-0000-0000-000000000141', 'explain', now() - interval '40 days' from generate_series(1, 5);
insert into public.usage_events (owner_id, kind)
  select 'aaaaaaaa-0000-0000-0000-000000000141', 'explain' from generate_series(1, 29);
select test.as_user('aaaaaaaa-0000-0000-0000-000000000141');
select test.check((select used from public.question_allowance()) = 30, 'questions from earlier months do not count');
reset role;

-- Changing the Free limit needs no code -----------------------------------------------------
update public.plans set monthly_message_limit = 50 where name = 'Free';
select test.as_user('aaaaaaaa-0000-0000-0000-000000000141');
select test.check((select monthly_limit from public.question_allowance()) = 50, 'changing the Free plan''s limit applies at once');
reset role;
update public.plans set monthly_message_limit = 30 where name = 'Free';

-- Reviewers and admins are not limited ------------------------------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000143');
select test.check((select unlimited from public.question_allowance()), 'reviewers and admins are not limited');
reset role;

-- Visitors ----------------------------------------------------------------------------------
select test.as_anon();
select test.refused($$select * from public.question_allowance()$$, 'visitors have no allowance');
select test.refused($$select public.record_ai_usage('explain', 'x', 1, 1, 0, 1)$$, 'visitors cannot record usage');
reset role;
