-- Permission tests at database level: group quiz extras (migration 62): get ready, streaks and the
-- answer chart. Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a5c62001-0000-0000-0000-000000000001', 'ada62@test.invalid', '{"full_name": "Ada Sixtytwo"}'),
  ('a5c62002-0000-0000-0000-000000000002', 'bola62@test.invalid', '{"full_name": "Bola Sixtytwo"}');
update public.pilot_settings set invite_only = false;
update public.chat_settings set open_to_students = true;

insert into public.courses (id, slug, name) values ('a5c62100-0000-0000-0000-000000000000', 'quiz-course-62', 'Quiz Course 62');
insert into public.topics (id, course_id, slug, name) values ('a5c62101-0000-0000-0000-000000000000', 'a5c62100-0000-0000-0000-000000000000', 'quiz-topic-62', 'Bail 62');
insert into public.topic_lessons (id, topic_id, title, content, status)
  values ('a5c62102-0000-0000-0000-000000000000', 'a5c62101-0000-0000-0000-000000000000', 'Bail', '{"sections": []}', 'approved');
insert into public.lesson_checkpoints (lesson_id, position, after_section, placement, kind, prompt, choices, correct_choice, answer, key_point)
  select 'a5c62102-0000-0000-0000-000000000000', n, 0, 'test', 'mcq', 'Question ' || n, '["A", "B", "C"]', 1, 'B', 'point ' || n from generate_series(0, 2) n;
update public.topic_lessons set status = 'approved' where id = 'a5c62102-0000-0000-0000-000000000000';

do $$
declare p uuid;
begin
  foreach p in array array['a5c62001-0000-0000-0000-000000000001', 'a5c62002-0000-0000-0000-000000000002']::uuid[] loop
    insert into public.chat_verifications (owner_id, kind, campus_key, id_number) values (p, 'student', 'abuja', 'NLS/62/' || right(p::text, 1));
    insert into public.chat_members (owner_id) values (p);
  end loop;
  update public.chat_verifications set status = 'approved' where id_number like 'NLS/62/%';
end $$;

select test.as_user('a5c62001-0000-0000-0000-000000000001');
select public.chat_create_study_group('Extras squad') as squad \gset
select public.chat_invite((select id from public.chat_groups where key = :'squad'), 'a5c62002-0000-0000-0000-000000000002');
reset role;
create temporary table g62 as select id from public.chat_groups where key = :'squad';
grant select on g62 to authenticated;
select test.as_user('a5c62002-0000-0000-0000-000000000002');
select public.chat_answer_invite((select id from g62), true);
reset role;

select test.as_user('a5c62001-0000-0000-0000-000000000001');
select public.chat_quiz_create((select id from g62), 'a5c62101-0000-0000-0000-000000000000', 3, 20) as quiz \gset
reset role;
select test.as_user('a5c62002-0000-0000-0000-000000000002');
select public.chat_quiz_join(:'quiz');
reset role;

-- Get ready ---------------------------------------------------------------------------------------
select test.as_user('a5c62001-0000-0000-0000-000000000001');
select public.chat_quiz_next(:'quiz');
select test.check((public.chat_quiz_state(:'quiz') ->> 'readyIn')::numeric > 0, 'a question opens after a short "get ready"');
select test.check(public.chat_quiz_state(:'quiz') -> 'question' = 'null'::jsonb, 'the question stays hidden until it opens');
select test.check(public.chat_quiz_answer(:'quiz', 0, 1) = 'early', 'and nobody can answer before it opens');
reset role;

-- Streaks and the answer chart ------------------------------------------------------------------
update public.chat_quizzes set question_started_at = now() where id = :'quiz';
select test.as_user('a5c62001-0000-0000-0000-000000000001');
select public.chat_quiz_answer(:'quiz', 0, 1);
reset role;
select test.as_user('a5c62002-0000-0000-0000-000000000002');
select public.chat_quiz_answer(:'quiz', 0, 2);
select test.check(public.chat_quiz_state(:'quiz') -> 'counts' = '[0, 1, 1]'::jsonb, 'once a question closes, everyone sees how many chose each answer');
reset role;
select test.as_user('a5c62001-0000-0000-0000-000000000001');
select test.check((public.chat_quiz_state(:'quiz') ->> 'myStreak')::int = 1, 'a right answer starts a streak');
select public.chat_quiz_next(:'quiz');
reset role;
update public.chat_quizzes set question_started_at = now() where id = :'quiz';
select test.as_user('a5c62001-0000-0000-0000-000000000001');
select test.check(public.chat_quiz_state(:'quiz') -> 'counts' = 'null'::jsonb, 'the chart stays hidden while a question is open');
select public.chat_quiz_answer(:'quiz', 1, 1);
reset role;
select test.as_user('a5c62002-0000-0000-0000-000000000002');
select public.chat_quiz_answer(:'quiz', 1, 1);
reset role;
select test.check((select points from public.chat_quiz_answers where quiz_id = :'quiz' and question = 1 and owner_id = 'a5c62001-0000-0000-0000-000000000001') between 1000 and 1100,
  'a second right answer in a row earns a 100-point streak bonus');
select test.check((select points from public.chat_quiz_answers where quiz_id = :'quiz' and question = 1 and owner_id = 'a5c62002-0000-0000-0000-000000000002') between 900 and 1000,
  'a right answer after a wrong one has no bonus');
select test.as_user('a5c62001-0000-0000-0000-000000000001');
select test.check((public.chat_quiz_state(:'quiz') -> 'leaderboard' -> 0 ->> 'streak')::int = 2, 'the leaderboard shows each player''s streak');
reset role;

update public.chat_settings set open_to_students = false;
