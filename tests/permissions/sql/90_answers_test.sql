-- Permission tests at database level: answers and their sources (migration 12).
-- Search covers every course when none is chosen, still approved material only.
-- A student's sources are theirs alone, and a source's wording is shown only while the
-- material is approved and not out of date.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000091', 'student91@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000092', 'student92@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000093', 'admin93@test.invalid');
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000093';

-- The admin adds approved items in two courses and one awaiting review --------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000093');
insert into public.kb_items (title, type, course_id)
  select 'Zorilla criminal', 'note', id from public.courses where slug = 'criminal-litigation';
insert into public.kb_items (title, type, course_id)
  select 'Zorilla corporate', 'note', id from public.courses where slug = 'corporate-law-practice';
insert into public.kb_items (title, type, course_id)
  select 'Zorilla pending', 'note', id from public.courses where slug = 'corporate-law-practice';
insert into public.kb_passages (item_id, position, heading, text)
  select id, 0, 'Heading of ' || title, 'Zorilla passage text in ' || title from public.kb_items where title like 'Zorilla %';
select test.make_reviewable('Zorilla %');
update public.kb_items set review_status = 'approved' where title in ('Zorilla criminal', 'Zorilla corporate');
reset role;

create table test.answers as
  select (select id from public.kb_passages p where p.item_id = (select id from public.kb_items where title = 'Zorilla criminal')) as criminal_passage,
         (select id from public.kb_passages p where p.item_id = (select id from public.kb_items where title = 'Zorilla corporate')) as corporate_passage;
grant select on test.answers to authenticated, anon;

-- Student A: search all courses, then save an answer with its sources -----------------
select test.as_user('cccccccc-0000-0000-0000-000000000091');
select test.check(
  (select array_agg(item_title order by item_title) from public.search_library('zorilla passage', null))
    = array['Zorilla corporate', 'Zorilla criminal'],
  'with no course chosen, search covers every course');
select test.check(
  (select count(*) from public.search_library('zorilla passage', null) where item_title = 'Zorilla pending') = 0,
  'all-course search still never returns material awaiting review');
select test.check(
  (select array_agg(item_title) from public.search_library('zorilla passage', (select id from public.courses where slug = 'criminal-litigation')))
    = array['Zorilla criminal'],
  'choosing a course still limits search to that course');

insert into public.conversations (title) values ('Zorilla chat');
insert into public.messages (conversation_id, role, content)
  select id, 'assistant', '{"text": "An answer [S1] [S2]"}' from public.conversations where title = 'Zorilla chat';
insert into public.message_sources (message_id, label, kb_passage_id, item_title, heading)
  select m.id, 1, (select criminal_passage from test.answers), 'Zorilla criminal', 'Heading of Zorilla criminal'
  from public.messages m join public.conversations c on c.id = m.conversation_id where c.title = 'Zorilla chat';
insert into public.message_sources (message_id, label, kb_passage_id, item_title, heading)
  select m.id, 2, (select corporate_passage from test.answers), 'Zorilla corporate', null
  from public.messages m join public.conversations c on c.id = m.conversation_id where c.title = 'Zorilla chat';
select test.check((select count(*) from public.message_sources) = 2, 'a student saves the sources of their answer');
select test.check(
  (select text from public.source_passage((select id from public.message_sources where label = 1))) = 'Zorilla passage text in Zorilla criminal',
  'a student opens the wording of their own source');
reset role;

create table test.sources as
  select s.id, s.label, s.message_id, m.conversation_id
  from public.message_sources s join public.messages m on m.id = s.message_id;
grant select on test.sources to authenticated, anon;

-- Student B --------------------------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000092');
select test.check((select count(*) from public.message_sources) = 0, 'students cannot see another student''s sources');
select test.check(
  (select count(*) from public.source_passage((select id from test.sources where label = 1))) = 0,
  'students cannot open the wording of another student''s source');
select test.refused(
  format('insert into public.message_sources (message_id, label, item_title) values (%L, 9, %L)',
    (select message_id from test.sources where label = 1), 'Fake'),
  'students cannot add sources to another student''s answer');
select test.refused(
  format('insert into public.messages (conversation_id, role, content) values (%L, %L, %L)',
    (select conversation_id from test.sources where label = 1), 'assistant', '{"text": "fake"}'),
  'students cannot add answers to another student''s chat');
reset role;

-- Withdrawing the material hides its wording at once -------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000093');
update public.kb_items set review_status = 'withdrawn' where title = 'Zorilla corporate';
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000091');
select test.check(
  (select not available and text is null and item_title = 'Zorilla corporate'
     from public.source_passage((select id from test.sources where label = 2))),
  'a withdrawn source shows as unavailable, without its wording');
reset role;

-- A later change in the law hides an out-of-date source's wording too ---------------
insert into public.law_changes (course_id, title, effective_on)
  select id, 'Zorilla change', '2099-01-01' from public.courses where slug = 'criminal-litigation';
select test.as_user('cccccccc-0000-0000-0000-000000000091');
select test.check(
  (select not available from public.source_passage((select id from test.sources where label = 1))),
  'an out-of-date source shows as unavailable');
reset role;
delete from public.law_changes where title = 'Zorilla change';

-- Visitors ---------------------------------------------------------------------
select test.as_anon();
select test.refused($$select * from public.message_sources$$, 'visitors cannot read sources');
select test.refused(
  format('select * from public.source_passage(%L)', (select id from test.sources where label = 1)),
  'visitors cannot open sources');
reset role;

-- Deleting the chat removes its answers and their sources --------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000091');
delete from public.conversations where title = 'Zorilla chat';
select test.check((select count(*) from public.message_sources) = 0, 'deleting a chat removes its sources');
reset role;

select test.check(true, 'Answer and source permission tests passed.');
