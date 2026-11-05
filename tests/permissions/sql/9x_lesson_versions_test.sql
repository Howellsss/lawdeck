-- Permission tests at database level: lesson versions and "new library material" (migration 48).
-- Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c48001-0000-0000-0000-000000000001', 'studentA48@test.invalid'),
  ('a5c48003-0000-0000-0000-000000000003', 'reviewer48@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a5c48003-0000-0000-0000-000000000003';
update public.pilot_settings set invite_only = false;
insert into public.topics (course_id, slug, name)
  select id, 'wombat-appeals-48', 'Wombat appeals' from public.courses where slug = 'civil-litigation';

-- Version 1 approved, with a question a student is revising ---------------------------------
select test.as_user('a5c48003-0000-0000-0000-000000000003');
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Wombat appeals v1', '{"sections": [{"heading": "One"}]}' from public.topics where slug = 'wombat-appeals-48';
insert into public.lesson_checkpoints (lesson_id, position, after_section, placement, kind, prompt, answer, key_point)
  select id, 0, 0, 'reading', 'short', 'When is a made-up appeal filed?', 'Within 14 days', 'appeal time' from public.topic_lessons where title = 'Wombat appeals v1';
update public.topic_lessons set status = 'approved' where title = 'Wombat appeals v1';
reset role;
insert into public.review_items (owner_id, checkpoint_id, topic_id, due_at, interval_days)
  select 'a5c48001-0000-0000-0000-000000000001', c.id, l.topic_id, now(), 1
    from public.lesson_checkpoints c join public.topic_lessons l on l.id = c.lesson_id where c.key_point = 'appeal time';

-- Version 2 is written beside it: students still read version 1 ------------------------------
select test.as_user('a5c48003-0000-0000-0000-000000000003');
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Wombat appeals v2', '{"sections": [{"heading": "Two"}]}' from public.topics where slug = 'wombat-appeals-48';
select test.check((select count(*) from public.topic_lessons where title like 'Wombat appeals%') = 2, 'a new version is written beside the approved one');
do $$
begin
  insert into public.topic_lessons (topic_id, title, content)
    select id, 'Wombat appeals v3', '{"a": 1}' from public.topics where slug = 'wombat-appeals-48';
  raise exception 'a second working version was allowed';
exception when unique_violation then
  raise notice 'ok';
end;
$$;
select test.check(true, 'but only one version can be worked on at a time (refused)');
reset role;
select test.as_user('a5c48001-0000-0000-0000-000000000001');
select test.check((select title from public.topic_lessons where title like 'Wombat appeals%') = 'Wombat appeals v1', 'students keep reading the approved version meanwhile');
reset role;

-- Approving version 2 replaces version 1 ---------------------------------------------------
select test.as_user('a5c48003-0000-0000-0000-000000000003');
update public.topic_lessons set status = 'approved' where title = 'Wombat appeals v2';
select test.check((select status = 'withdrawn' and replaced_by is not null from public.topic_lessons where title = 'Wombat appeals v1'), 'approving the new version withdraws the old one and marks it replaced');
reset role;
select test.check((select count(*) from public.review_items where owner_id = 'a5c48001-0000-0000-0000-000000000001') = 0, 'revision of the old version''s questions ends');
select test.as_user('a5c48001-0000-0000-0000-000000000001');
select test.check((select title from public.topic_lessons where title like 'Wombat appeals%') = 'Wombat appeals v2', 'students now read only the new version');
reset role;

-- New library material ------------------------------------------------------------------------
select test.as_user('a5c48001-0000-0000-0000-000000000001');
update public.topic_lessons set new_material_at = now() where title like 'Wombat appeals%';
reset role;
select test.check((select count(*) from public.topic_lessons where new_material_at is not null) = 0, 'students cannot mark lessons');
select test.as_user('a5c48003-0000-0000-0000-000000000003');
update public.topic_lessons set new_material_at = now() where title = 'Wombat appeals v2';
select test.check((select new_material_at is not null and status = 'approved' from public.topic_lessons where title = 'Wombat appeals v2'),
  'reviewers mark new library material without sending the lesson back to review');
select test.refused($$update public.topic_lessons set replaced_by = null where title = 'Wombat appeals v1'$$, 'only the database marks a version as replaced');
reset role;
