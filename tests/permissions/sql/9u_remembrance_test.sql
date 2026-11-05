-- Permission tests at database level: lessons and each student's learning records (migration 45).
-- Made-up names and topics only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c45001-0000-0000-0000-000000000001', 'studentA45@test.invalid'),
  ('a5c45002-0000-0000-0000-000000000002', 'studentB45@test.invalid'),
  ('a5c45003-0000-0000-0000-000000000003', 'reviewer45@test.invalid'),
  ('a5c45004-0000-0000-0000-000000000004', 'admin45@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a5c45003-0000-0000-0000-000000000003';
update public.profiles set role = 'admin' where id = 'a5c45004-0000-0000-0000-000000000004';
update public.pilot_settings set invite_only = false;
insert into public.topics (course_id, slug, name)
  select id, 'quokka-summons-45', 'Quokka summons' from public.courses where slug = 'civil-litigation';

-- A reviewer writes a lesson with a checkpoint and an authority; it starts as a draft --------
select test.as_user('a5c45003-0000-0000-0000-000000000003');
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Quokka summons', '{"sections": [{"heading": "One"}]}' from public.topics where slug = 'quokka-summons-45';
insert into public.lesson_checkpoints (lesson_id, position, after_section, placement, kind, prompt, choices, correct_choice, answer, key_point)
  select id, 0, 0, 'reading', 'mcq', 'Which court?', '["High", "Low"]', 0, 'High', 'which court' from public.topic_lessons where title = 'Quokka summons';
insert into public.lesson_authorities (lesson_id, key, kind, name, principle)
  select id, 'wombat-v-quokka', 'case', 'Wombat v Quokka', 'A made-up principle.' from public.topic_lessons where title = 'Quokka summons';
select test.check((select status from public.topic_lessons where title = 'Quokka summons') = 'pending', 'a new lesson waits for review');
select test.refused($$insert into public.lesson_checkpoints (lesson_id, position, after_section, placement, kind, prompt, answer, key_point)
  select id, 1, 0, 'reading', 'mcq', 'An MCQ with no options', 'x', 'x' from public.topic_lessons where title = 'Quokka summons'$$,
  'a multiple-choice checkpoint needs its options and right answer');
reset role;

select test.as_user('a5c45001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.topic_lessons) = 0, 'students cannot see a draft lesson');
select test.check((select count(*) from public.lesson_checkpoints) = 0, 'or its checkpoints');
select test.check((select count(*) from public.lesson_authorities) = 0, 'or its authorities');
select test.refused($$insert into public.topic_lessons (topic_id, title, content)
  select id, 'Student lesson', '{"a": 1}' from public.topics where slug = 'quokka-summons-45'$$, 'students cannot write lessons');
update public.topic_lessons set status = 'approved';
reset role;
select test.check((select status from public.topic_lessons where title = 'Quokka summons') = 'pending', 'students cannot approve lessons');

-- Approved: students can read it; changing it sends it back to review ----------------------
select test.as_user('a5c45003-0000-0000-0000-000000000003');
update public.topic_lessons set status = 'approved' where title = 'Quokka summons';
select test.check((select reviewed_by from public.topic_lessons where title = 'Quokka summons') = 'a5c45003-0000-0000-0000-000000000003',
  'the database records who approved it');
reset role;
select test.as_user('a5c45001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.topic_lessons) = 1, 'students read an approved lesson');
select test.check((select count(*) from public.lesson_checkpoints) = 1, 'and its checkpoints');
select test.check((select count(*) from public.lesson_authorities) = 1, 'and its authorities');
reset role;

update public.pilot_settings set invite_only = true;
select test.as_user('a5c45001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.topic_lessons) = 0, 'while invite-only, students without access read no lessons');
reset role;
update public.pilot_settings set invite_only = false;

select test.as_user('a5c45003-0000-0000-0000-000000000003');
update public.lesson_checkpoints set prompt = 'Which court heard it?' where key_point = 'which court';
select test.check((select status from public.topic_lessons where title = 'Quokka summons') = 'pending',
  'changing a checkpoint sends the lesson back to review');
update public.topic_lessons set status = 'approved' where title = 'Quokka summons';
update public.topic_lessons set content = '{"sections": [{"heading": "Two"}]}' where title = 'Quokka summons';
select test.check((select status from public.topic_lessons where title = 'Quokka summons') = 'pending'
  and (select version from public.topic_lessons where title = 'Quokka summons') = 2,
  'changing the text sends it back to review as version 2');
update public.topic_lessons set status = 'approved' where title = 'Quokka summons';
reset role;

-- Each student's records are their own ------------------------------------------------------
select test.as_user('a5c45001-0000-0000-0000-000000000001');
insert into public.study_sessions (topic_id) select id from public.topics where slug = 'quokka-summons-45';
do $$
begin
  insert into public.study_sessions (topic_id) select id from public.topics where slug = 'quokka-summons-45';
  raise exception 'FAILED: a second session for the same topic and day was allowed';
exception when unique_violation then
  raise notice 'ok - one study session per topic per day: a second visit continues the first (refused)';
end $$;
insert into public.recall_attempts (session_id, topic_id, checkpoint_id, prompt, key_point, context, choice, outcome)
  select s.id, s.topic_id, c.id, c.prompt, c.key_point, 'reading', 0, 'correct'
    from public.study_sessions s, public.lesson_checkpoints c;
insert into public.review_items (checkpoint_id, topic_id, due_at)
  select c.id, s.topic_id, now() + interval '1 day' from public.study_sessions s, public.lesson_checkpoints c;
insert into public.diary_notes (topic_id, body) select id, 'My own note' from public.topics where slug = 'quokka-summons-45';
select test.refused($$update public.study_sessions set owner_id = 'a5c45002-0000-0000-0000-000000000002'$$,
  'a session cannot be handed to someone else');
reset role;

select test.as_user('a5c45002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.study_sessions) = 0, 'student B cannot see A''s sessions');
select test.check((select count(*) from public.recall_attempts) = 0, 'or A''s answers');
select test.check((select count(*) from public.review_items) = 0, 'or A''s revision schedule');
select test.check((select count(*) from public.diary_notes) = 0, 'or A''s notes');
update public.diary_notes set body = 'changed by B';
delete from public.study_sessions;
reset role;
do $$
declare a_session uuid; a_topic uuid;
begin
  select id, topic_id into a_session, a_topic from public.study_sessions
   where owner_id = 'a5c45001-0000-0000-0000-000000000001';
  perform test.as_user('a5c45002-0000-0000-0000-000000000002');
  perform test.refused(format(
    'insert into public.recall_attempts (session_id, topic_id, prompt, key_point, context, outcome) values (%L, %L, %L, %L, %L, %L)',
    a_session, a_topic, 'x?', 'x', 'reading', 'correct'), 'B cannot add answers to A''s session');
end $$;
reset role;
select test.check((select body from public.diary_notes where owner_id = 'a5c45001-0000-0000-0000-000000000001') = 'My own note',
  'B cannot change A''s notes');
select test.check((select count(*) from public.study_sessions where owner_id = 'a5c45001-0000-0000-0000-000000000001') = 1,
  'or delete A''s sessions');

select test.as_user('a5c45003-0000-0000-0000-000000000003');
select test.check((select count(*) from public.study_sessions) = 0, 'staff do not read students'' learning records either');
reset role;

select test.as_anon();
select test.refused($$select count(*) from public.topic_lessons$$, 'visitors cannot read lessons');
reset role;
