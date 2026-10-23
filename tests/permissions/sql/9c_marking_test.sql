-- Permission tests at database level: "Mark my answer" (migration 20). Students get approved
-- marking questions and guides through the marking functions only, never drafts or withdrawn ones.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000201', 'student201@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000202', 'reviewer202@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000202';

select test.as_user('dddddddd-0000-0000-0000-000000000202');
insert into public.rubrics (course_id, title, question, criteria)
  select id, 'Wombat approved', 'Your client''s wombat writ has expired. Advise.', '[{"point": "Expired", "marks": 2}, {"point": "Renew", "marks": 3}]'
  from public.courses where slug = 'civil-litigation';
insert into public.rubrics (course_id, title, question, criteria)
  select id, 'Wombat draft', 'A draft question that is not approved.', '[{"point": "Secret", "marks": 1}]'
  from public.courses where slug = 'civil-litigation';
update public.rubrics set status = 'approved' where title = 'Wombat approved';
reset role;

select test.as_user('cccccccc-0000-0000-0000-000000000201');
select test.check((select count(*) from public.rubrics) = 0, 'students still cannot read the rubrics table');
select test.check(
  (select array_agg(title) from public.marking_questions()) = array['Wombat approved'],
  'students see approved marking questions only');
select test.check((select total_marks from public.marking_questions()) = 5, 'the question shows its total marks');
select test.check(
  (select count(*) from public.marking_guide((select id from public.marking_questions() limit 1))) = 1,
  'the server can read an approved guide for marking');
reset role;
create table test.marking as select id from public.rubrics where title = 'Wombat draft';
grant select on test.marking to authenticated;
select test.as_user('cccccccc-0000-0000-0000-000000000201');
select test.check((select count(*) from public.marking_guide((select id from test.marking))) = 0,
  'a draft guide is never given out for marking');
select public.record_ai_usage('marking', 'claude-opus-5-5', 100, 50, 0.08, 1000);
select test.check((select used from public.question_allowance()) = 1, 'a marked answer counts toward the monthly allowance');
reset role;

-- Withdrawing a guide takes it out of marking at once ----------------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000202');
update public.rubrics set status = 'withdrawn' where title = 'Wombat approved';
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000201');
select test.check((select count(*) from public.marking_questions()) = 0, 'a withdrawn guide is no longer offered');
reset role;

select test.as_anon();
select test.refused($$select * from public.marking_questions()$$, 'visitors cannot list marking questions');
select test.refused($$select * from public.marking_guide(gen_random_uuid())$$, 'visitors cannot read a marking guide');
reset role;
