-- Permission tests at database level: group quizzes (migration 61). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a5c61001-0000-0000-0000-000000000001', 'ada61@test.invalid', '{"full_name": "Ada Sixtyone"}'),
  ('a5c61002-0000-0000-0000-000000000002', 'bola61@test.invalid', '{"full_name": "Bola Sixtyone"}'),
  ('a5c61003-0000-0000-0000-000000000003', 'chi61@test.invalid', '{"full_name": "Chi Sixtyone"}'),
  ('a5c61005-0000-0000-0000-000000000005', 'admin61@test.invalid', '{"full_name": "Admin Sixtyone"}');
update public.profiles set role = 'admin' where id = 'a5c61005-0000-0000-0000-000000000005';
update public.pilot_settings set invite_only = false;
update public.chat_settings set open_to_students = true;

-- A topic with an approved lesson and four multiple-choice questions (answer: choice 1).
insert into public.courses (id, slug, name) values ('a5c61100-0000-0000-0000-000000000000', 'quiz-course-61', 'Quiz Course 61');
insert into public.topics (id, course_id, slug, name) values ('a5c61101-0000-0000-0000-000000000000', 'a5c61100-0000-0000-0000-000000000000', 'quiz-topic-61', 'Originating processes 61');
insert into public.topic_lessons (id, topic_id, title, content, status)
  values ('a5c61102-0000-0000-0000-000000000000', 'a5c61101-0000-0000-0000-000000000000', 'Originating processes', '{"sections": []}', 'approved');
insert into public.lesson_checkpoints (lesson_id, position, after_section, placement, kind, prompt, choices, correct_choice, answer, key_point)
  select 'a5c61102-0000-0000-0000-000000000000', n, 0, 'test', 'mcq', 'Question ' || n, '["A", "B", "C"]', 1, 'B', 'point ' || n from generate_series(0, 3) n;
-- Adding questions sends a lesson back for review, so it is approved again afterwards.
update public.topic_lessons set status = 'approved' where id = 'a5c61102-0000-0000-0000-000000000000';

do $$
declare p uuid;
begin
  foreach p in array array['a5c61001-0000-0000-0000-000000000001', 'a5c61002-0000-0000-0000-000000000002', 'a5c61003-0000-0000-0000-000000000003']::uuid[] loop
    insert into public.chat_verifications (owner_id, kind, campus_key, id_number, status) values (p, 'student', 'lagos', 'NLS/61/' || right(p::text, 1), 'pending');
    insert into public.chat_members (owner_id) values (p);
  end loop;
  update public.chat_verifications set status = 'approved' where id_number like 'NLS/61/%';
end $$;

select test.as_user('a5c61001-0000-0000-0000-000000000001');
select public.chat_create_study_group('Quiz squad') as squad \gset
select public.chat_invite((select id from public.chat_groups where key = :'squad'), 'a5c61002-0000-0000-0000-000000000002');
reset role;
create temporary table g61 as select id, key from public.chat_groups where key in (:'squad', 'lagos');
grant select on g61 to authenticated;
select test.as_user('a5c61002-0000-0000-0000-000000000002');
select public.chat_answer_invite((select id from g61 where key like 's-%'), true);
reset role;

-- Hosting ---------------------------------------------------------------------------------------
select test.as_user('a5c61001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.chat_quiz_topics() where topic = 'Originating processes 61') = 1, 'topics with an approved lesson can be quizzed');
select test.refused($$select public.chat_quiz_create((select id from g61 where key = 'lagos'), 'a5c61101-0000-0000-0000-000000000000', 4, 20)$$, 'quizzes are for study groups only');
select test.refused($$select public.chat_quiz_create((select id from g61 where key like 's-%'), 'a5c61101-0000-0000-0000-000000000000', 4, 5)$$, 'at least 10 seconds a question');
select public.chat_quiz_create((select id from g61 where key like 's-%'), 'a5c61101-0000-0000-0000-000000000000', 10, 20) as quiz \gset
select test.check((public.chat_quiz_state(:'quiz') ->> 'total')::int = 4, 'a member hosts a quiz with the topic''s questions');
select test.check((select count(*) from public.chat_messages where body like '🎯 Group quiz on **Originating processes 61**%') = 1, 'and the group is told');
select test.refused($$select public.chat_quiz_create((select id from g61 where key like 's-%'), 'a5c61101-0000-0000-0000-000000000000', 4, 20)$$, 'one quiz at a time');
select test.refused($$select * from public.chat_quizzes$$, 'nobody reads the quiz tables directly');
reset role;

select test.as_user('a5c61003-0000-0000-0000-000000000003');
select test.check(public.chat_quiz_state(:'quiz') is null, 'people outside the group cannot see the quiz');
select test.check(public.chat_quiz_join(:'quiz') = 'not_allowed', 'or join it');
reset role;

-- Playing ---------------------------------------------------------------------------------------
select test.as_user('a5c61002-0000-0000-0000-000000000002');
select test.check(public.chat_quiz_join(:'quiz') = 'ok', 'a member joins');
select test.check(public.chat_quiz_next(:'quiz') = 'not_allowed', 'only the host starts and moves the quiz on');
select test.check(public.chat_quiz_answer(:'quiz', 0, 1) = 'not_allowed', 'nobody answers before it starts');
reset role;
select test.as_user('a5c61001-0000-0000-0000-000000000001');
select test.check(public.chat_quiz_next(:'quiz') = 'ok', 'the host starts the quiz');
reset role;
-- Questions open after a 3-second "get ready" (migration 62); skip it here.
update public.chat_quizzes set question_started_at = now() where id = :'quiz';
select test.as_user('a5c61001-0000-0000-0000-000000000001');
select test.check(public.chat_quiz_state(:'quiz') -> 'question' ->> 'prompt' like 'Question %', 'everyone sees the question');
select test.check(public.chat_quiz_state(:'quiz') ->> 'correctChoice' is null, 'but not the answer while it is open');
select test.check(public.chat_quiz_answer(:'quiz', 0, 1) = 'ok', 'the host answers');
select test.check(public.chat_quiz_state(:'quiz') ->> 'correctChoice' is null, 'the answer stays hidden until everyone has answered');
select test.check(public.chat_quiz_answer(:'quiz', 0, 2) = 'already', 'one answer each');
reset role;
select test.as_user('a5c61002-0000-0000-0000-000000000002');
select test.check(public.chat_quiz_answer(:'quiz', 0, 0) = 'ok', 'a player answers');
select test.check((public.chat_quiz_state(:'quiz') ->> 'correctChoice')::int = 1, 'once everyone has answered, the right answer shows');
select test.check((public.chat_quiz_state(:'quiz') ->> 'myCorrect')::boolean = false, 'with whether you were right');
reset role;
select test.as_user('a5c61001-0000-0000-0000-000000000001');
select test.check((public.chat_quiz_state(:'quiz') -> 'leaderboard' -> 0 ->> 'name') = 'Ada Sixtyone', 'the leaderboard puts the right answer first');
select test.check((public.chat_quiz_state(:'quiz') -> 'leaderboard' -> 0 ->> 'points')::int between 500 and 1000, 'a right answer scores 500 to 1000 points');
select public.chat_quiz_next(:'quiz');
select test.check(public.chat_quiz_answer(:'quiz', 0, 1) = 'not_allowed', 'a closed question cannot be answered');
reset role;
-- Time runs out on question 2.
update public.chat_quizzes set question_started_at = now() - interval '25 seconds' where id = :'quiz';
select test.as_user('a5c61002-0000-0000-0000-000000000002');
select test.check(public.chat_quiz_answer(:'quiz', 1, 1) = 'late', 'answers after the timer do not count');
select test.check((public.chat_quiz_state(:'quiz') ->> 'correctChoice')::int = 1, 'and the answer shows when time is up');
reset role;
select test.as_user('a5c61001-0000-0000-0000-000000000001');
select test.check(public.chat_quiz_end(:'quiz') = 'ok', 'the host can end the quiz');
select test.check(public.chat_quiz_state(:'quiz') ->> 'status' = 'done', 'and it shows the final leaderboard');
select test.check(public.chat_quiz_latest((select id from g61 where key like 's-%')) = :'quiz', 'the Quiz tab finds the latest quiz');
reset role;

set role anon;
select test.refused($$select public.chat_quiz_topics()$$, 'visitors cannot use quizzes');
reset role;

update public.chat_settings set open_to_students = false;
