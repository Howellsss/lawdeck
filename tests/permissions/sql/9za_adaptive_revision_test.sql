-- Permission tests at database level: adaptive revision timing (migration 52). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c52001-0000-0000-0000-000000000001', 'studentA52@test.invalid'),
  ('a5c52002-0000-0000-0000-000000000002', 'studentB52@test.invalid'),
  ('a5c52003-0000-0000-0000-000000000003', 'reviewer52@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a5c52003-0000-0000-0000-000000000003';
update public.pilot_settings set invite_only = false;
insert into public.topics (course_id, slug, name)
  select id, 'bilby-motions-52', 'Bilby motions' from public.courses where slug = 'civil-litigation';

select test.as_user('a5c52003-0000-0000-0000-000000000003');
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Bilby motions', '{"sections": [{"heading": "One"}]}' from public.topics where slug = 'bilby-motions-52';
insert into public.lesson_checkpoints (lesson_id, position, after_section, placement, kind, prompt, answer, key_point)
  select id, 0, 0, 'reading', 'short', 'Who files a bilby motion?', 'The applicant', 'who files' from public.topic_lessons where title = 'Bilby motions';
update public.topic_lessons set status = 'approved' where title = 'Bilby motions';
reset role;
create temporary table point_52 as
  select c.id as checkpoint_id, l.topic_id from public.lesson_checkpoints c join public.topic_lessons l on l.id = c.lesson_id
  where l.title = 'Bilby motions';
grant select on point_52 to authenticated;

select test.as_user('a5c52001-0000-0000-0000-000000000001');
insert into public.review_items (checkpoint_id, topic_id, due_at) select checkpoint_id, topic_id, now() + interval '1 day' from point_52;
select test.check((select ease = 2.50 from public.review_items), 'a new revision point starts at the normal ease');
update public.review_items set ease = 1.90, interval_days = 2;
select test.check((select ease = 1.90 from public.review_items), 'a student''s own point''s ease can change as they answer');
select test.refused($$update public.review_items set ease = 0.5$$, 'ease cannot fall below the lowest setting');
select test.refused($$update public.review_items set ease = 4$$, 'or rise above the highest');
reset role;

select test.as_user('a5c52002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.review_items) = 0, 'student B cannot see A''s revision points or their ease');
update public.review_items set ease = 3;
reset role;
select test.check((select ease = 1.90 from public.review_items where owner_id = 'a5c52001-0000-0000-0000-000000000001'),
  'and cannot change them');
