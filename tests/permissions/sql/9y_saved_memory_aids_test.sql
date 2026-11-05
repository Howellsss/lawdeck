-- Permission tests at database level: saved memory aids (migration 49). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c49001-0000-0000-0000-000000000001', 'studentA49@test.invalid'),
  ('a5c49002-0000-0000-0000-000000000002', 'studentB49@test.invalid'),
  ('a5c49003-0000-0000-0000-000000000003', 'reviewer49@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a5c49003-0000-0000-0000-000000000003';
update public.pilot_settings set invite_only = false;
insert into public.topics (course_id, slug, name)
  select id, 'quokka-bail-49', 'Quokka bail' from public.courses where slug = 'civil-litigation';

select test.as_user('a5c49003-0000-0000-0000-000000000003');
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Quokka bail', '{"sections": [{"heading": "One"}]}' from public.topics where slug = 'quokka-bail-49';
insert into public.lesson_extras (lesson_id) select id from public.topic_lessons where title = 'Quokka bail';
insert into public.lesson_memory_aids (extras_id, position, after_section, kind, title, device, items)
  select e.id, 0, 0, 'acronym', 'Made-up bail conditions', 'QB', '[{"key": "Q", "meaning": "Quiet"}, {"key": "B", "meaning": "Bond"}]'
    from public.lesson_extras e join public.topic_lessons l on l.id = e.lesson_id where l.title = 'Quokka bail';
reset role;
create temporary table aid_49 as select id from public.lesson_memory_aids where title = 'Made-up bail conditions';
grant select on aid_49 to authenticated;

-- Not yet approved: it cannot be saved -----------------------------------------------------
select test.as_user('a5c49001-0000-0000-0000-000000000001');
select test.refused($$insert into public.saved_memory_aids (aid_id) select id from aid_49$$, 'an aid a student cannot read cannot be saved');
reset role;

select test.as_user('a5c49003-0000-0000-0000-000000000003');
update public.topic_lessons set status = 'approved' where title = 'Quokka bail';
update public.lesson_extras set status = 'approved';
reset role;

-- Approved: student A saves it; the copy comes from the aid --------------------------------
select test.as_user('a5c49001-0000-0000-0000-000000000001');
insert into public.saved_memory_aids (aid_id) select id from aid_49;
select test.check((select device = 'QB' and title = 'Made-up bail conditions' from public.saved_memory_aids), 'a student saves an approved aid, copied from the aid');
delete from public.saved_memory_aids;
insert into public.saved_memory_aids (aid_id, device, title) select id, 'Invented', 'Invented title' from aid_49;
select test.check((select device = 'QB' and title = 'Made-up bail conditions' and not made_for_me from public.saved_memory_aids),
  'whatever a student sends, a lesson''s aid is copied from the aid itself');
reset role;

select test.as_user('a5c49002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.saved_memory_aids) = 0, 'student B cannot see student A''s saved aids');
delete from public.saved_memory_aids;
reset role;
select test.check((select count(*) from public.saved_memory_aids) = 1, 'or remove them');

-- The saved copy outlives an update of the lesson ---------------------------------------------
select test.as_user('a5c49003-0000-0000-0000-000000000003');
delete from public.lesson_memory_aids where title = 'Made-up bail conditions';
reset role;
select test.check((select device = 'QB' and aid_id is null from public.saved_memory_aids), 'a saved aid stays after the lesson''s aids are rewritten');

select test.as_user('a5c49001-0000-0000-0000-000000000001');
delete from public.saved_memory_aids;
select test.check((select count(*) from public.saved_memory_aids) = 0, 'a student removes their own saved aid');
reset role;
drop table aid_49;

-- Migration 50: an aid made for the student, and the new kind of AI call --------------------
select test.as_user('a5c49001-0000-0000-0000-000000000001');
insert into public.saved_memory_aids (topic_id, kind, title, device, items)
  select id, 'phrase', 'Made-up bail conditions', 'Quiet quokkas bond', '[]' from public.topics where slug = 'quokka-bail-49';
select test.check((select made_for_me from public.saved_memory_aids where device = 'Quiet quokkas bond'), 'an aid made for the student is saved and marked as such');
select test.refused($$insert into public.saved_memory_aids (topic_id, kind, title, device)
  values ('a5c49009-0000-0000-0000-000000000009', 'phrase', 'Nowhere', 'x')$$, 'but only for a topic that exists');
select public.record_ai_usage('memory_aid', 'claude-sonnet-5-5', 100, 50, 0.001, 900);
select test.check((select count(*) from public.usage_events where kind = 'memory_aid') = 1, 'a memory aid made on request is recorded');
reset role;
