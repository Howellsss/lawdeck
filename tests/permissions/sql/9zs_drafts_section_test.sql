-- Database tests: the "Drafts and precedents (all courses)" library section (migration 70).
-- Its approved material is searched with every course's questions; material awaiting review is not;
-- other courses still stay apart.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a7000001-0000-0000-0000-000000000001', 'student70@test.invalid'),
  ('a7000002-0000-0000-0000-000000000002', 'admin70@test.invalid');
update public.profiles set role = 'admin' where id = 'a7000002-0000-0000-0000-000000000002';

select test.check(
  (select shared and name = 'Drafts and precedents (all courses)' from public.courses where slug = 'drafts-and-precedents'),
  'there is one shared library section for drafts and precedents');
select test.check(
  (select count(*) = 5 from public.courses where not shared and slug in
     ('civil-litigation', 'criminal-litigation', 'property-law-practice', 'corporate-law-practice', 'law-in-practice')),
  'the five Law School courses are not shared sections');

select test.as_user('a7000002-0000-0000-0000-000000000002');
insert into public.kb_items (title, type, course_id)
  select t, 'draft', c.id
  from (values ('Quagga draft approved'), ('Quagga draft pending')) v(t),
       public.courses c where c.slug = 'drafts-and-precedents';
insert into public.kb_items (title, type, course_id)
  select 'Quagga property note', 'note', id from public.courses where slug = 'property-law-practice';
insert into public.kb_passages (item_id, position, text)
  select id, 0, 'Quagga precedent words about ' || title from public.kb_items where title like 'Quagga %';
select test.make_reviewable('Quagga %');
update public.kb_items set source_kind = 'publication' where title like 'Quagga %';
update public.kb_items set review_status = 'approved' where title in ('Quagga draft approved', 'Quagga property note');
reset role;

create table test.course70 as select slug, id from public.courses;
grant select on test.course70 to authenticated, anon;

select test.as_user('a7000001-0000-0000-0000-000000000001');
select test.check(
  (select array_agg(item_title order by item_title)
     from public.search_library('quagga precedent', (select id from test.course70 where slug = 'civil-litigation')))
    = array['Quagga draft approved'],
  'a Civil Litigation question also finds approved drafts and precedents, never ones awaiting review');
select test.check(
  (select array_agg(item_title order by item_title)
     from public.search_library('quagga precedent', (select id from test.course70 where slug = 'property-law-practice')))
    = array['Quagga draft approved', 'Quagga property note'],
  'a Property question finds its own course and the drafts section');
select test.check(
  (select count(*) = 0
     from public.search_library('quagga precedent', (select id from test.course70 where slug = 'civil-litigation'))
    where item_title = 'Quagga property note'),
  'other courses still stay apart');
reset role;
