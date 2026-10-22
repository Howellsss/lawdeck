-- Permission tests at database level: practice sets, items, attempts and rubrics (migration 17).
-- Phase 4 exit check: all practice data passes the two-student permission tests.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000171', 'studentA171@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000172', 'studentB172@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000173', 'reviewer173@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000174', 'admin174@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000173';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000174';

create table test.practice as
  select (select id from public.courses where slug = 'civil-litigation') as civil,
         (select id from public.courses where slug = 'criminal-litigation') as criminal;
insert into public.topics (course_id, slug, name)
  select civil, 'quokka-writs', 'Quokka writs' from test.practice;
insert into public.topics (course_id, slug, name)
  select criminal, 'quokka-bail', 'Quokka bail' from test.practice;
alter table test.practice add column civil_topic uuid, add column criminal_topic uuid;
update test.practice set civil_topic = (select id from public.topics where slug = 'quokka-writs'),
                         criminal_topic = (select id from public.topics where slug = 'quokka-bail');
grant select on test.practice to authenticated, anon;

-- Student A makes a multiple-choice set and answers a question -----------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000171');
insert into public.practice_sets (course_id, topic_id, kind, title)
  select civil, civil_topic, 'mcq', 'Quokka writs quiz' from test.practice;
insert into public.practice_items (set_id, position, question, choices, correct_choice, answer, sources)
  select id, 0, 'How long does a quokka writ last?', '["3 months", "6 months"]', 1, 'Six months [S1].',
         '[{"label": 1, "title": "Quokka notes"}]'
  from public.practice_sets where title = 'Quokka writs quiz';
insert into public.attempts (item_id, choice, score)
  select id, 1, 100 from public.practice_items where question like 'How long%';
update public.practice_items set known = true where question like 'How long%';
select test.check((select count(*) from public.practice_sets) = 1, 'a student makes a practice set');
select test.check((select count(*) from public.attempts) = 1, 'a student records an answer');
select test.check((select known from public.practice_items where question like 'How long%'), 'a student marks a card as known');
select test.refused($$insert into public.practice_sets (course_id, topic_id, kind, title)
  select criminal, civil_topic, 'mcq', 'Mismatched' from test.practice$$,
  'a set cannot name a topic from another course');
select test.refused($$insert into public.practice_items (set_id, position, question, choices, correct_choice, answer)
  select id, 1, 'Q?', '["a", "b"]', 4, 'A.' from public.practice_sets where title = 'Quokka writs quiz'$$,
  'the right answer must be one of the choices');
select test.refused($$update public.practice_items set question = 'Changed'$$, 'a student cannot rewrite a question');
select test.refused($$update public.attempts set score = 0$$, 'a student cannot change an attempt');
select test.check((select count(*) from public.rubrics) = 0, 'students cannot see rubrics');
select test.refused($$insert into public.rubrics (course_id, title) select civil, 'Mine' from test.practice$$,
  'students cannot write rubrics');
reset role;

-- Student B sees and touches none of it ----------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000172');
select test.check((select count(*) from public.practice_sets) = 0, 'another student cannot see the set');
select test.check((select count(*) from public.practice_items) = 0, 'another student cannot see the questions');
select test.check((select count(*) from public.attempts) = 0, 'another student cannot see the answers');
update public.practice_items set known = false;
delete from public.practice_sets;
reset role;
select test.check((select known from public.practice_items where question like 'How long%'),
  'another student cannot change the flashcard mark');
select test.check((select count(*) from public.practice_sets) = 1, 'another student cannot delete the set');

do $$
declare a_set uuid := (select id from public.practice_sets where title = 'Quokka writs quiz');
declare a_item uuid := (select id from public.practice_items where question like 'How long%');
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000172');
  begin
    execute format('insert into public.practice_items (set_id, position, question, answer) values (%L, 5, %L, %L)', a_set, 'Sneaky?', 'Yes.');
    raise exception 'FAILED: another student added a question to the set';
  exception when foreign_key_violation or insufficient_privilege or check_violation then
    raise notice 'ok - another student cannot add questions to the set (refused)';
  end;
  begin
    execute format('insert into public.attempts (item_id, choice) values (%L, 0)', a_item);
    raise exception 'FAILED: another student answered the question';
  exception when foreign_key_violation or insufficient_privilege or check_violation then
    raise notice 'ok - another student cannot answer someone else''s question (refused)';
  end;
  reset role;
end $$;

-- Reviewers write and approve rubrics; the database records who approved -----------------
select test.as_user('dddddddd-0000-0000-0000-000000000173');
insert into public.rubrics (course_id, topic_id, title, question, criteria)
  select civil, civil_topic, 'Quokka writ answer', 'How long does a quokka writ last?', '[{"point": "Six months", "marks": 2}]' from test.practice;
update public.rubrics set status = 'approved' where title = 'Quokka writ answer';
select test.check((select reviewed_by from public.rubrics where title = 'Quokka writ answer') = 'dddddddd-0000-0000-0000-000000000173',
  'approving a rubric records the reviewer');
select test.check((select count(*) from public.practice_sets) = 0, 'reviewers cannot see students'' practice');
delete from public.rubrics;
reset role;
select test.check((select count(*) from public.rubrics) = 1, 'reviewers cannot delete rubrics');
select test.as_user('eeeeeeee-0000-0000-0000-000000000174');
delete from public.rubrics where title = 'Quokka writ answer';
reset role;
select test.check((select count(*) from public.rubrics) = 0, 'admins can remove rubrics');

-- Visitors get nothing ---------------------------------------------------------------------
select test.as_anon();
select test.refused($$select * from public.practice_sets$$, 'visitors cannot read practice sets');
select test.refused($$select * from public.rubrics$$, 'visitors cannot read rubrics');
reset role;

-- A practice set counts as one question this month -----------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000171');
select public.record_ai_usage('practice', 'claude-sonnet-5-5', 100, 50, 0.01, 1000);
select test.check((select used from public.question_allowance()) = 1, 'a practice set counts toward the monthly allowance');
reset role;

-- Deleting the set removes its questions and answers --------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000171');
delete from public.practice_sets;
select test.check((select count(*) from public.practice_items) + (select count(*) from public.attempts) = 0,
  'deleting a set removes its questions and answers');
reset role;

-- Marking guides with their question (migration 19) -----------------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000173');
insert into public.rubrics (course_id, title, question, criteria)
  select civil, 'Quokka renewal', 'Your client''s quokka writ has expired. Advise.', '[{"point": "Writ expired", "marks": 2}]' from test.practice;
update public.rubrics set status = 'approved' where title = 'Quokka renewal';
select test.check((select status from public.rubrics where title = 'Quokka renewal') = 'approved', 'a reviewer approves a complete guide');
update public.rubrics set criteria = '[{"point": "Writ expired", "marks": 3}]' where title = 'Quokka renewal';
select test.check((select status = 'pending' and reviewed_by is null from public.rubrics where title = 'Quokka renewal'),
  'changing an approved guide puts it back to draft');
insert into public.rubrics (course_id, title) select civil, 'Quokka empty' from test.practice;
select test.refused($$update public.rubrics set status = 'approved' where title = 'Quokka empty'$$,
  'a guide without its question and points cannot be approved');
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000171');
select test.check((select count(*) from public.rubrics) = 0, 'students still cannot see marking guides');
reset role;
