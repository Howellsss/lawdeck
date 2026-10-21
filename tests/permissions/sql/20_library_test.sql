-- Permission tests at database level: the library (System Design §4).
-- Students: approved item details only, never passages or files.
-- Reviewers: see everything, change review details and passage wording only.
-- Admins: add and remove items, passages and files.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000003', 'student@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000004', 'reviewer@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'admin@test.invalid');
-- Roles are set by the database owner (in Supabase: the founder in the SQL Editor).
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000004';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000005';

-- The admin adds two items with passages and one file ----------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000005');
insert into public.kb_items (title, type, course_id)
  select 'Approved note', 'note', id from public.courses where slug = 'civil-litigation';
insert into public.kb_items (title, type, course_id)
  select 'Pending note', 'note', id from public.courses where slug = 'civil-litigation';
insert into public.kb_passages (item_id, position, text)
  select id, 0, 'Passage of ' || title from public.kb_items;
insert into storage.objects (bucket_id, name) values ('library', 'civil-litigation/approved.pdf');
select test.make_reviewable('%note');
update public.kb_items set review_status = 'approved' where title = 'Approved note';
select test.check(
  (select reviewed_by from public.kb_items where title = 'Approved note') = 'eeeeeeee-0000-0000-0000-000000000005'
  and (select reviewed_at from public.kb_items where title = 'Approved note') is not null,
  'approving records who approved and when');
select test.check((select count(*) from public.kb_passages) = 2, 'admins see all passages');
reset role;

create table test.library as
  select (select id from public.kb_items where title = 'Pending note') as pending_id,
         (select id from public.kb_items where title = 'Approved note') as approved_id;
grant select on test.library to authenticated, anon;

-- A student --------------------------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.check((select count(*) from public.kb_items) = 1, 'students see only approved items');
select test.check((select title from public.kb_items) = 'Approved note', 'the item students see is the approved one');
select test.check((select count(*) from public.kb_passages) = 0, 'students cannot read passages, even approved ones');
select test.check((select count(*) from storage.objects where bucket_id = 'library') = 0, 'students cannot see library files');
select test.check(not public.is_reviewer() and not public.is_admin(), 'a student is neither reviewer nor admin');
update public.kb_items set review_status = 'approved' where id = (select pending_id from test.library);
select test.refused(
  $$insert into public.kb_items (title, type, course_id) select 'Fake', 'note', id from public.courses limit 1$$,
  'students cannot add library items');
select test.refused(
  format('insert into public.kb_passages (item_id, position, text) values (%L, 9, %L)', (select approved_id from test.library), 'fake'),
  'students cannot add passages');
select test.refused(
  $$insert into storage.objects (bucket_id, name) values ('library', 'fake.pdf')$$,
  'students cannot upload library files');
reset role;
select test.check(
  (select review_status from public.kb_items where title = 'Pending note') = 'pending',
  'a student''s attempt to approve an item changed nothing');

-- A reviewer -------------------------------------------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000004');
select test.check((select count(*) from public.kb_items) = 2, 'reviewers see all items, approved or not');
select test.check((select count(*) from public.kb_passages) = 2, 'reviewers read all passages');
select test.check((select count(*) from storage.objects where bucket_id = 'library') = 1, 'reviewers can read library files');
update public.kb_items set review_status = 'approved', law_current_as_of = '2026-09-01'
  where id = (select pending_id from test.library);
select test.check(
  (select reviewed_by from public.kb_items where title = 'Pending note') = 'dddddddd-0000-0000-0000-000000000004',
  'a reviewer can approve, and is recorded as the reviewer');
update public.kb_passages set text = 'Corrected wording' where item_id = (select pending_id from test.library);
select test.check(
  (select text from public.kb_passages where item_id = (select pending_id from test.library)) = 'Corrected wording',
  'a reviewer can correct a passage''s wording');
select test.refused(
  format('update public.kb_items set title = %L where id = %L', 'Renamed', (select pending_id from test.library)),
  'reviewers cannot change an item''s details');
select test.refused(
  $$update public.kb_passages set embedding_model = 'fake'$$,
  'reviewers cannot change search data');
select test.refused(
  $$insert into public.kb_items (title, type, course_id) select 'Fake', 'note', id from public.courses limit 1$$,
  'reviewers cannot add items');
select test.refused(
  $$insert into storage.objects (bucket_id, name) values ('library', 'fake.pdf')$$,
  'reviewers cannot upload library files');
delete from public.kb_items;
select test.check((select count(*) from public.kb_items) = 2, 'reviewers cannot delete items');
-- Withdrawing an item hides it from students straight away.
update public.kb_items set review_status = 'withdrawn' where title = 'Approved note';
reset role;

select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.check(
  (select count(*) from public.kb_items where title = 'Approved note') = 0,
  'a withdrawn item disappears for students');
reset role;

-- Visitors ---------------------------------------------------------------------
select test.as_anon();
select test.refused($$select * from public.kb_items$$, 'visitors cannot read library items');
select test.refused($$select * from public.kb_passages$$, 'visitors cannot read passages');
select test.check((select count(*) from storage.objects where bucket_id = 'library') = 0, 'visitors cannot see library files');
reset role;

-- The admin removes an item; its passages go with it ---------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000005');
delete from public.kb_items where title = 'Approved note';
select test.check((select count(*) from public.kb_passages) = 1, 'removing an item removes its passages');
delete from storage.objects where name = 'civil-litigation/approved.pdf';
select test.check((select count(*) from storage.objects) = 0, 'admins can remove library files');
reset role;

select test.check(true, 'Library permission tests passed.');
