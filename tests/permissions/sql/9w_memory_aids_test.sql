-- Permission tests at database level: memory aids and stories (migration 47). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c47001-0000-0000-0000-000000000001', 'studentA47@test.invalid'),
  ('a5c47003-0000-0000-0000-000000000003', 'reviewer47@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a5c47003-0000-0000-0000-000000000003';
update public.pilot_settings set invite_only = false;
insert into public.topics (course_id, slug, name)
  select id, 'wombat-contracts-47', 'Wombat contracts' from public.courses where slug = 'civil-litigation';

-- A reviewer writes a lesson and its memory aids; both start awaiting review ----------------
select test.as_user('a5c47003-0000-0000-0000-000000000003');
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Wombat contracts', '{"sections": [{"heading": "One"}]}' from public.topics where slug = 'wombat-contracts-47';
insert into public.lesson_extras (lesson_id) select id from public.topic_lessons where title = 'Wombat contracts';
insert into public.lesson_memory_aids (extras_id, position, after_section, kind, title, device, items)
  select e.id, 0, 0, 'acronym', 'Made-up elements', 'WOM', '[{"key": "W", "meaning": "Wish"}, {"key": "O", "meaning": "Offer"}, {"key": "M", "meaning": "Meeting"}]'
    from public.lesson_extras e join public.topic_lessons l on l.id = e.lesson_id where l.title = 'Wombat contracts';
insert into public.lesson_stories (extras_id, position, after_section, kind, title, parts, takeaway, question, choices, correct_choice)
  select e.id, 0, 0, 'everyday', 'Ada sells a bicycle', '[{"heading": "What happened", "text": "A made-up story."}]', 'A made-up takeaway.',
         'Which?', '["This", "That"]', 0
    from public.lesson_extras e join public.topic_lessons l on l.id = e.lesson_id where l.title = 'Wombat contracts';
select test.check((select status from public.lesson_extras) = 'pending', 'new memory aids wait for review');
select test.refused($$insert into public.lesson_stories (extras_id, position, after_section, kind, title, parts, takeaway)
  select id, 1, 0, 'case', 'A case with no authority', '[{"heading": "x", "text": "x"}]', 'x' from public.lesson_extras$$,
  'a case story must name the lesson authority it tells');
select test.refused($$insert into public.lesson_stories (extras_id, position, after_section, kind, title, parts, takeaway, question, choices, correct_choice)
  select id, 1, 0, 'everyday', 'Bad question', '[{"heading": "x", "text": "x"}]', 'x', 'Which?', '["One", "Two"]', 5 from public.lesson_extras$$,
  'a story question needs a right answer among its choices');
reset role;

select test.as_user('a5c47001-0000-0000-0000-000000000001');
select test.refused($$insert into public.lesson_extras (lesson_id) select id from public.topic_lessons$$, 'students cannot add memory aids');
reset role;

-- Approved aids on a lesson awaiting review stay hidden; both approved, students read them -----
select test.as_user('a5c47003-0000-0000-0000-000000000003');
update public.lesson_extras set status = 'approved';
select test.check((select reviewed_by from public.lesson_extras) = 'a5c47003-0000-0000-0000-000000000003', 'the database records who approved them');
reset role;
select test.as_user('a5c47001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.lesson_memory_aids) = 0, 'aids stay hidden while their lesson awaits review');
reset role;
select test.as_user('a5c47003-0000-0000-0000-000000000003');
update public.topic_lessons set status = 'approved' where title = 'Wombat contracts';
reset role;
select test.as_user('a5c47001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.lesson_extras) = 1, 'students read approved memory aids of an approved lesson');
select test.check((select count(*) from public.lesson_memory_aids) = 1, 'and the aids');
select test.check((select count(*) from public.lesson_stories) = 1, 'and the stories');
update public.lesson_extras set status = 'withdrawn';
delete from public.lesson_memory_aids;
reset role;
select test.check((select status from public.lesson_extras) = 'approved', 'students cannot change the review state');
select test.check((select count(*) from public.lesson_memory_aids) = 1, 'or remove aids');

update public.pilot_settings set invite_only = true;
select test.as_user('a5c47001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.lesson_memory_aids) = 0, 'while invite-only, students without access read no aids');
reset role;
update public.pilot_settings set invite_only = false;

-- Changes send them back to review ---------------------------------------------------------
select test.as_user('a5c47003-0000-0000-0000-000000000003');
update public.lesson_extras set bulk_approved = true;
delete from public.lesson_stories;
select test.check((select status = 'pending' and not bulk_approved from public.lesson_extras), 'removing a story sends the set back to review, unmarked');
update public.lesson_extras set status = 'approved';
update public.topic_lessons set content = '{"sections": [{"heading": "Two"}]}' where title = 'Wombat contracts';
select test.check((select status from public.lesson_extras) = 'pending', 'changing the lesson sends its memory aids back to review');
reset role;

-- Deleting a lesson removes its memory aids.
delete from public.topic_lessons where title = 'Wombat contracts';
select test.check((select count(*) from public.lesson_memory_aids) = 0, 'a deleted lesson takes its memory aids with it');
