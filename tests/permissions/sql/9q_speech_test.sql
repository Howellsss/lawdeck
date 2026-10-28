-- Permission tests at database level: reading answers aloud (migration 38). Speech is recorded
-- for the person who heard it, counts towards their own daily reading total only, never towards
-- the monthly question allowance, and visitors can do neither.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c38001-0000-0000-0000-000000000001', 'student38a@test.invalid'),
  ('a5c38002-0000-0000-0000-000000000002', 'student38b@test.invalid'),
  ('a5c38003-0000-0000-0000-000000000003', 'reviewer38@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a5c38003-0000-0000-0000-000000000003';

select test.as_user('a5c38001-0000-0000-0000-000000000001');
select test.check((select used = 0 and not unlimited from public.speech_used_today()), 'a new student has heard nothing today and is limited');
select public.record_ai_usage('speech', 'en-NG-EzinneNeural', 1200, 0, 0.0192, 900);
select public.record_ai_usage('speech', 'en-NG-EzinneNeural', 800, 0, 0.0128, 700);
select test.check((select used from public.speech_used_today()) = 2000, 'what a student hears adds up for the day');
select test.check((select used from public.question_allowance()) = 0, 'reading aloud never uses up questions');
-- Migration 40: voice-mode small talk is recorded but free; a reply that teaches counts.
select public.record_ai_usage('talk_chat', 'claude-sonnet-5-5', 900, 40, 0.002, 1500);
select test.check((select used from public.question_allowance()) = 0, 'voice-mode small talk never uses up questions');
select public.record_ai_usage('explain', 'claude-sonnet-5-5', 9000, 200, 0.02, 4000);
select test.check((select used from public.question_allowance()) = 1, 'a voice-mode reply that teaches from the library counts as a question');
select test.check((select count(*) from public.usage_events where kind = 'talk_chat') = 1, 'small talk is still logged with its cost');
reset role;

select test.as_user('a5c38002-0000-0000-0000-000000000002');
select test.check((select used from public.speech_used_today()) = 0, 'one student''s listening never counts against another');
reset role;

select test.as_user('a5c38003-0000-0000-0000-000000000003');
select test.check((select unlimited from public.speech_used_today()), 'reviewers are not limited');
reset role;

select test.as_anon();
select test.refused($$select * from public.speech_used_today()$$, 'visitors cannot check reading totals');
select test.refused($$select public.record_ai_usage('speech', 'x', 1, 0, 0, 1)$$, 'visitors cannot record speech');
reset role;

delete from public.usage_events where owner_id::text like 'a5c3800%';
delete from auth.users where id::text like 'a5c3800%';
