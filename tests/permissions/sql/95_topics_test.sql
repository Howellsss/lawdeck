-- Permission tests at database level: course topics and Auto routing (migration 13).
-- Admins add, rename, reorder and remove topics; students and reviewers only read them.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000101', 'student101@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000102', 'reviewer102@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000103', 'admin103@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000102';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000103';

-- An admin manages topics ------------------------------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000103');
insert into public.topics (course_id, slug, name, position)
  select id, 'yak-topic', 'Yak topic', 1 from public.courses where slug = 'civil-litigation';
update public.topics set name = 'Yak topic renamed', position = 2 where slug = 'yak-topic';
select test.check(
  (select name = 'Yak topic renamed' and position = 2 from public.topics where slug = 'yak-topic'),
  'admins add, rename and reorder topics');
select test.refused(
  $$update public.topics set slug = 'other' where slug = 'yak-topic'$$,
  'a topic''s web address never changes once made');
reset role;

-- A student and a reviewer -----------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000101');
select test.check((select count(*) from public.topics where slug = 'yak-topic') = 1, 'students read topics');
select test.refused(
  $$insert into public.topics (course_id, slug, name) select id, 'fake', 'Fake' from public.courses limit 1$$,
  'students cannot add topics');
update public.topics set name = 'Hacked' where slug = 'yak-topic';
delete from public.topics where slug = 'yak-topic';
reset role;
select test.check(
  (select name from public.topics where slug = 'yak-topic') = 'Yak topic renamed',
  'students cannot rename or remove topics');

select test.as_user('dddddddd-0000-0000-0000-000000000102');
select test.refused(
  $$insert into public.topics (course_id, slug, name) select id, 'fake', 'Fake' from public.courses limit 1$$,
  'reviewers cannot add topics');
delete from public.topics where slug = 'yak-topic';
reset role;
select test.check((select count(*) from public.topics where slug = 'yak-topic') = 1, 'reviewers cannot remove topics');

-- Visitors ---------------------------------------------------------------------
select test.as_anon();
select test.refused($$select * from public.topics$$, 'visitors cannot read topics');
reset role;

-- Auto routing is recorded on the student's own chat -----------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000101');
insert into public.conversations (title, auto_routed) values ('Yak auto chat', true);
select test.check(
  (select auto_routed from public.conversations where title = 'Yak auto chat'),
  'a chat started in Auto mode remembers it');
delete from public.conversations where title = 'Yak auto chat';
reset role;

-- The admin removes the topic --------------------------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000103');
delete from public.topics where slug = 'yak-topic';
select test.check((select count(*) from public.topics where slug = 'yak-topic') = 0, 'admins remove topics');
reset role;

select test.check(true, 'Topic and routing permission tests passed.');
