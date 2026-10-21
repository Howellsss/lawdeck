-- Permission tests at database level: out-of-date material leaves student search, and the
-- archive of original files (migration 11).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000081', 'student81@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000082', 'reviewer82@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000083', 'admin83@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000082';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000083';

create table test.recheck as select id as course_id from public.courses where slug = 'property-law-practice';
grant select on test.recheck to authenticated, anon;

-- Two approved Property Law items: one checked to 2023, one to 2025 ----------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000083');
insert into public.kb_items (title, type, course_id)
  select t, 'note', (select course_id from test.recheck) from (values ('Recheck older'), ('Recheck newer')) v(t);
insert into public.kb_passages (item_id, position, text)
  select id, 0, 'Quokka consent passage in ' || title from public.kb_items where title like 'Recheck %';
select test.make_reviewable('Recheck %');
update public.kb_items set law_current_as_of = '2023-01-31' where title = 'Recheck older';
update public.kb_items set law_current_as_of = '2025-01-31' where title = 'Recheck newer';
update public.kb_items set review_status = 'approved' where title like 'Recheck %';
reset role;

create function test.recheck_titles() returns text[] language sql as $$
  select coalesce(array_agg(distinct item_title order by item_title), '{}')
  from public.search_library('quokka consent', (select course_id from test.recheck))
$$;
grant execute on function test.recheck_titles() to authenticated;

select test.as_user('cccccccc-0000-0000-0000-000000000081');
select test.check(test.recheck_titles() = array['Recheck newer', 'Recheck older'], 'before any law change, students find both items');
reset role;

-- A reviewer records a change in the law from 2024 ----------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000082');
insert into public.law_changes (course_id, title, effective_on)
  select course_id, 'Consent rules amended', '2024-06-01' from test.recheck;
select test.check(test.recheck_titles() = array['Recheck newer', 'Recheck older'], 'reviewers still find out-of-date items, to check them');
reset role;

select test.as_user('cccccccc-0000-0000-0000-000000000081');
select test.check(test.recheck_titles() = array['Recheck newer'], 'students no longer find items checked before the change');
reset role;

-- Other courses are not affected ----------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000081');
select test.check(
  (select count(*) from public.law_changes) = 0,
  'students still cannot see the law changes themselves');
reset role;

-- The reviewer re-checks the older item: it comes back ----------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000082');
update public.kb_items set law_current_as_of = '2024-07-01' where title = 'Recheck older';
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000081');
select test.check(test.recheck_titles() = array['Recheck newer', 'Recheck older'], 'a re-checked item returns to student search');
reset role;

-- The archive of original files -------------------------------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000083');
insert into storage.objects (bucket_id, name) values ('library-archive', 'course/item/abc.pdf');
select test.check((select count(*) from storage.objects where bucket_id = 'library-archive') = 1, 'admins can archive and read original files');
delete from storage.objects where bucket_id = 'library-archive';
update storage.objects set name = 'course/item/changed.pdf' where bucket_id = 'library-archive';
reset role;
select test.check(
  (select count(*) from storage.objects where bucket_id = 'library-archive' and name = 'course/item/abc.pdf') = 1,
  'nobody can delete or rename an archived file, admins included');

select test.as_user('dddddddd-0000-0000-0000-000000000082');
select test.check((select count(*) from storage.objects where bucket_id = 'library-archive') = 0, 'reviewers cannot see the archive');
select test.refused($$insert into storage.objects (bucket_id, name) values ('library-archive', 'fake.pdf')$$, 'reviewers cannot add to the archive');
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000081');
select test.check((select count(*) from storage.objects where bucket_id = 'library-archive') = 0, 'students cannot see the archive');
reset role;

-- The archive record on an item: admins write it once; nobody changes it ------------
select test.as_user('dddddddd-0000-0000-0000-000000000082');
select test.refused($$update public.kb_items set archive_path = 'x' where title = 'Recheck older'$$, 'reviewers cannot record the archived copy');
reset role;
select test.as_user('eeeeeeee-0000-0000-0000-000000000083');
update public.kb_items set archive_path = 'course/item/abc.pdf' where title = 'Recheck older';
select test.check((select archive_path from public.kb_items where title = 'Recheck older') = 'course/item/abc.pdf', 'admins record the archived copy');
select test.refused($$update public.kb_items set archive_path = 'course/item/other.pdf' where title = 'Recheck older'$$, 'the archived copy cannot be changed, even by admins');
select test.refused($$update public.kb_items set archive_path = null where title = 'Recheck older'$$, 'the archived copy cannot be cleared');
reset role;
