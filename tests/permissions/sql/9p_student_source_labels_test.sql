-- Permission tests at database level: student-facing source labels, tracing and rights
-- (migration 37). Students never get a lecturer's name, a private title or file name, or the
-- page numbers of private notes; official documents keep their titles; admins trace everything.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c37001-0000-0000-0000-000000000001', 'student37@test.invalid'),
  ('a5c37002-0000-0000-0000-000000000002', 'reviewer37@test.invalid'),
  ('a5c37003-0000-0000-0000-000000000003', 'admin37@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a5c37002-0000-0000-0000-000000000002';
update public.profiles set role = 'admin' where id = 'a5c37003-0000-0000-0000-000000000003';

-- The admin adds one item of each kind (made-up names) -------------------------------------
select test.as_user('a5c37003-0000-0000-0000-000000000003');
insert into public.kb_items (title, type, course_id, file_name, source)
  select v.title, v.type::public.kb_item_type, c.id, v.file_name, 'https://drive.google.com/file/d/qx' || v.n
  from (values
    (1, 'QX REVIEW CIVIL LITIGATION HANDBOOK 2025', 'course_material', 'QX REVIEW CIVIL LITIGATION HANDBOOK 2025.pdf'),
    (2, 'Constitution of the Federal Republic of Qxland 1999', 'statute', 'qx-constitution.pdf'),
    (3, 'Rules of Professional Conduct for Qx Practitioners', 'course_material', 'qx-rpc.pdf'),
    (4, 'A. B. Qxumi''s Notes on Civil Litigation', 'note', 'A. B. Qxumi''s Notes on Civil Litigation.pdf'),
    (5, 'QX STUDY PACK', 'course_material', 'qx-pack.pdf'),
    (6, 'QX MISC', 'course_material', 'scan001.pdf')
  ) v(n, title, type, file_name)
  cross join public.courses c where c.slug = 'civil-litigation';
insert into public.kb_passages (item_id, position, heading, text, page_from, page_to)
  select id, 0,
         case when title like 'QX MISC' then null
              when title like 'A. B.%' then 'ACCRUAL OF ACTION' else 'Qxheading ' || title end,
         'Qxword ' || repeat('word ', 80) || title, 12, 13
  from public.kb_items where title like 'QX%' or title like '%Qx%';
-- A second passage of the notes whose heading names the author: never used as a topic.
insert into public.kb_passages (item_id, position, heading, text, page_from)
  select id, 1, 'A. B. QXUMI''S NOTES ON CIVIL LITIGATION', 'Qxword second part', 1
  from public.kb_items where title like 'A. B.%';
select test.make_reviewable('%Qx%');
select test.make_reviewable('QX%');
update public.kb_items set review_status = 'approved' where title like '%Qx%' or title like 'QX%';
reset role;

-- First guesses ----------------------------------------------------------------------------
select test.check((select source_kind from public.kb_items where title like 'QX REVIEW%') = 'publication', 'a named handbook is a publication');
select test.check((select source_kind from public.kb_items where title like 'Constitution%Qxland%') = 'official', 'the constitution is an official document');
select test.check((select source_kind from public.kb_items where title like 'Rules of Professional Conduct%Qx%') = 'official', 'the Rules of Professional Conduct are official');
select test.check((select source_kind from public.kb_items where title like 'A. B.%') = 'lecturer_note', 'a lecturer''s notes are recognised from the name');
select test.check((select source_kind from public.kb_items where title = 'QX STUDY PACK') = 'pending', 'material with no clear title or author awaits identification');

create table test.labels as
  select i.title, p.id as passage_id, p.position from public.kb_passages p join public.kb_items i on i.id = p.item_id
   where i.title like '%Qx%' or i.title like 'QX%';
grant select on test.labels to authenticated, anon;

-- What a student gets from search and labels -------------------------------------------------
select test.as_user('a5c37001-0000-0000-0000-000000000001');
select test.check(
  (select bool_and(item_title not like '%Qxumi%' and item_title not like '%.pdf%')
     from public.search_library('qxword', (select id from public.courses where slug = 'civil-litigation'), null, null, 30)),
  'search never gives a student a lecturer''s name or a file name');
select test.check(
  (select item_title from public.search_library('qxword', (select id from public.courses where slug = 'civil-litigation'), null, null, 30)
    where text like '%QX REVIEW%') = 'Qx Review Civil Litigation Handbook 2025',
  'a named handbook keeps its title, tidied');
select test.check(
  (select page_from from public.search_library('qxword', (select id from public.courses where slug = 'civil-litigation'), null, null, 30)
    where text like '%QX REVIEW%') = 12,
  'a publication keeps its page numbers');
select test.check(
  (select label from public.kb_passage_labels(array(select passage_id from test.labels where title like 'A. B.%' and position = 0)))
    = (select name from public.courses where slug = 'civil-litigation') || ' — Accrual of Action',
  'a lecturer''s notes show the course and the topic');
select test.check(
  (select label not like '%Qxumi%' from public.kb_passage_labels(array(select passage_id from test.labels where title like 'A. B.%' and position = 1))),
  'a heading that names the author is never used as the topic');
select test.check(
  (select heading is null and not show_pages
     from public.kb_passage_labels(array(select passage_id from test.labels where title like 'A. B.%' and position = 0))),
  'private notes show no heading of their own and no page numbers');
select test.check(
  (select label from public.kb_passage_labels(array(select passage_id from test.labels where title = 'QX MISC'))) = 'Study Material — Pending Identification',
  'material with no topic at all is labelled as pending identification');
select test.check(
  (select label from public.kb_passage_labels(array(select passage_id from test.labels where title like 'Constitution%'))) = 'Constitution of the Federal Republic of Qxland 1999',
  'an official document keeps its exact title');
select test.check(
  (select count(*) from public.kb_items where title like 'A. B.%' or title = 'QX STUDY PACK') = 0,
  'students cannot read lecturer notes or unclassified items directly');
select test.check(
  (select count(*) from public.kb_items where title like 'Constitution%Qxland%') = 1,
  'students still read official items directly');
select test.refused($$select * from public.admin_answer_sources(gen_random_uuid())$$, 'students cannot trace sources');
select test.refused('select * from public.admin_item_usage(gen_random_uuid())', 'students cannot see item usage');

-- A student's answer that draws on three documents -------------------------------------------
insert into public.conversations (title) values ('Qx chat');
insert into public.messages (conversation_id, role, content)
  select id, 'assistant', '{"text": "An answer [S1] [S2] [S3]"}' from public.conversations where title = 'Qx chat';
insert into public.message_sources (message_id, label, kb_passage_id, item_title, heading, page_from, page_to)
  select m.id, n, l.passage_id, 'raw title sent by an old app', 'raw heading', 12, 13
  from public.messages m join public.conversations c on c.id = m.conversation_id,
       (values (1, 'A. B.%'), (2, 'Constitution%'), (3, 'QX REVIEW%')) v(n, pattern)
  join test.labels l on l.title like v.pattern and l.position = 0
  where c.title = 'Qx chat';
select test.check(
  (select item_title from public.source_passage((select id from public.message_sources where label = 1 and item_title like 'raw%'))) not like '%raw%',
  'opening a source shows its current student label');
select test.check(
  (select array_length(regexp_split_to_array(replace(text, ' …', ''), '\s+'), 1) <= 50 and not full_text and page_from is null
     from public.source_passage((select id from public.message_sources where label = 1))),
  'lecturer notes open as a short extract of 50 words at most, without page numbers');
select test.check(
  (select full_text and text like '%Constitution%' from public.source_passage((select id from public.message_sources where label = 2))),
  'statutes open in full');
select test.check(
  (select course_slug = 'civil-litigation' from public.source_passage((select id from public.message_sources where label = 3))),
  'a source names the course to study it in');
reset role;

create table test.answer37 as
  select m.id from public.messages m join public.conversations c on c.id = m.conversation_id where c.title = 'Qx chat';
grant select on test.answer37 to authenticated, anon;

-- Administrators trace every original source --------------------------------------------------
select test.as_user('a5c37002-0000-0000-0000-000000000002');
select test.refused($$select * from public.admin_answer_sources((select id from test.answer37))$$, 'reviewers cannot trace student answers');
reset role;
select test.as_user('a5c37003-0000-0000-0000-000000000003');
select test.check((select count(*) from public.admin_answer_sources((select id from test.answer37))) = 3, 'an answer from three documents keeps all three');
select test.check(
  (select original_title like 'A. B.%' and file_name like '%.pdf' and drive_source like 'https://drive.google.com/%' and page_from = 12 and passage_text like 'Qxword%'
     from public.admin_answer_sources((select id from test.answer37)) where label = 1),
  'admins see the original title, file, Drive link, page and passage');
select test.check(
  (select answers = 1 and students = 1 from public.admin_item_usage((select id from public.kb_items where title like 'A. B.%'))),
  'admins see which answers relied on an item');
-- Relabelling an item updates the saved sources.
update public.kb_items set source_kind = 'publication', display_title = 'Qx Civil Litigation Study Notes' where title like 'A. B.%';
select test.check(
  (select student_label from public.admin_answer_sources((select id from test.answer37)) where label = 1) = 'Qx Civil Litigation Study Notes',
  'changing how an item is presented updates the answers that used it');
-- Restricting an item withdraws it.
update public.kb_items set rights_status = 'restricted', rights_note = 'Permission withdrawn' where title like 'A. B.%';
select test.check((select review_status from public.kb_items where title like 'A. B.%') = 'withdrawn', 'restricted rights withdraw the item from students');
reset role;
select test.check(
  (select title = 'A. B. Qxumi''s Notes on Civil Litigation' and file_name like 'A. B.%' from public.kb_items where title like 'A. B.%'),
  'the original title and file name are never changed');

delete from public.message_sources where message_id in (select id from test.answer37);
delete from public.conversations where title = 'Qx chat';
delete from public.kb_items where title like '%Qx%' or title like 'QX%';
delete from auth.users where id::text like 'a5c3700%';
