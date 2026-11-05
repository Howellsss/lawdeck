-- Permission tests at database level: approving a course's lessons together, and reporting a
-- problem in a lesson (migration 46). Made-up names and topics only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c46001-0000-0000-0000-000000000001', 'studentA46@test.invalid'),
  ('a5c46003-0000-0000-0000-000000000003', 'reviewer46@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a5c46003-0000-0000-0000-000000000003';
update public.pilot_settings set invite_only = false;
insert into public.topics (course_id, slug, name)
  select id, 'wombat-pleadings-46', 'Wombat pleadings' from public.courses where slug = 'civil-litigation';

select test.as_user('a5c46003-0000-0000-0000-000000000003');
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Wombat pleadings', '{"sections": [{"heading": "One"}]}' from public.topics where slug = 'wombat-pleadings-46';
insert into public.lesson_checkpoints (lesson_id, position, after_section, placement, kind, prompt, answer, key_point)
  select id, 0, 0, 'reading', 'short', 'What is pleaded?', 'Facts', 'pleaded facts' from public.topic_lessons where title = 'Wombat pleadings';
-- A draft cannot carry the mark.
update public.topic_lessons set bulk_approved = true where title = 'Wombat pleadings';
select test.check(not (select bulk_approved from public.topic_lessons where title = 'Wombat pleadings'), 'a lesson awaiting review is never marked approved-with-the-course');
update public.topic_lessons set status = 'approved', bulk_approved = true where title = 'Wombat pleadings';
select test.check((select bulk_approved and status = 'approved' from public.topic_lessons where title = 'Wombat pleadings'), 'a reviewer approves a lesson with its course');
reset role;

-- Students see the mark, cannot change it, and can report a problem in the lesson -------------
select test.as_user('a5c46001-0000-0000-0000-000000000001');
select test.check((select bulk_approved from public.topic_lessons where title = 'Wombat pleadings'), 'students see that it was approved with its course');
update public.topic_lessons set bulk_approved = false;
insert into public.problem_reports (target_kind, target_id, category, note)
  select 'lesson', id, 'wrong_law', 'Made-up note' from public.topic_lessons where title = 'Wombat pleadings';
select test.check((select count(*) from public.problem_reports where target_kind = 'lesson') = 1, 'a student reports a problem in a lesson they can read');
select test.refused($$insert into public.problem_reports (target_kind, target_id, category)
  values ('lesson', 'a5c46009-0000-0000-0000-000000000009', 'other')$$, 'but not in a lesson that does not exist');
reset role;
select test.check((select bulk_approved from public.topic_lessons where title = 'Wombat pleadings'), 'students cannot clear the mark');

select test.as_user('a5c46003-0000-0000-0000-000000000003');
select test.check((select title from public.problem_report_context((select id from public.problem_reports where target_kind = 'lesson'))) = 'Lesson: Wombat pleadings',
  'reviewers see which lesson was reported');
-- Changing a part sends it back to review and clears the mark; approving it alone leaves it unmarked.
update public.lesson_checkpoints set prompt = 'What must be pleaded?' where key_point = 'pleaded facts';
select test.check((select status = 'pending' and not bulk_approved from public.topic_lessons where title = 'Wombat pleadings'), 'a changed lesson goes back to review, unmarked');
update public.topic_lessons set status = 'approved', bulk_approved = true where title = 'Wombat pleadings';
update public.topic_lessons set content = '{"sections": [{"heading": "Two"}]}' where title = 'Wombat pleadings';
select test.check((select status = 'pending' and not bulk_approved from public.topic_lessons where title = 'Wombat pleadings'), 'edited content goes back to review, unmarked');
reset role;

-- A draft lesson the student cannot see cannot be reported.
insert into public.topics (course_id, slug, name)
  select id, 'quokka-motions-46', 'Quokka motions' from public.courses where slug = 'civil-litigation';
select test.as_user('a5c46003-0000-0000-0000-000000000003');
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Quokka motions', '{"sections": [{"heading": "One"}]}' from public.topics where slug = 'quokka-motions-46';
reset role;
create temporary table draft_46 as select id from public.topic_lessons where title = 'Quokka motions';
grant select on draft_46 to authenticated;
select test.as_user('a5c46001-0000-0000-0000-000000000001');
select test.refused($$insert into public.problem_reports (target_kind, target_id, category)
  select 'lesson', id, 'other' from draft_46$$, 'a student cannot report a draft lesson they cannot see');
reset role;
drop table draft_46;
