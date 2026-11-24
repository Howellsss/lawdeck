-- Database tests: the library list's passage and page counts (migration 72). Reviewers and admins
-- get them in one call; students get nothing; the read rules on passages and pages are unchanged.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a7200001-0000-0000-0000-000000000001', 'reviewer72@test.invalid'),
  ('a7200002-0000-0000-0000-000000000002', 'student72@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a7200001-0000-0000-0000-000000000001';

insert into public.kb_items (id, title, type, course_id)
  select 'b7200001-0000-0000-0000-000000000001', 'Counts item', 'note', id from public.courses where slug = 'civil-litigation';
insert into public.kb_items (id, title, type, course_id)
  select 'b7200002-0000-0000-0000-000000000002', 'Counts empty item', 'note', id from public.courses where slug = 'civil-litigation';
insert into public.kb_passages (item_id, position, text) values
  ('b7200001-0000-0000-0000-000000000001', 0, 'First passage.'),
  ('b7200001-0000-0000-0000-000000000001', 1, 'Second passage.'),
  ('b7200001-0000-0000-0000-000000000001', 2, 'Third passage.');
insert into public.kb_item_pages (item_id, page, text, method) values
  ('b7200001-0000-0000-0000-000000000001', 1, 'Page one.', 'text'),
  ('b7200001-0000-0000-0000-000000000001', 2, 'Page two.', 'text');

select test.as_user('a7200001-0000-0000-0000-000000000001');
select test.check(
  (select passages = 3 and pages = 2 from public.library_item_counts(array['b7200001-0000-0000-0000-000000000001'::uuid])),
  'a reviewer gets an item''s passage and page counts');
select test.check(
  (select passages = 0 and pages = 0 from public.library_item_counts(array['b7200002-0000-0000-0000-000000000002'::uuid])),
  'an item not read yet counts zero');
select test.check(
  (select count(*) = 2 from public.library_item_counts(array['b7200001-0000-0000-0000-000000000001'::uuid, 'b7200002-0000-0000-0000-000000000002'::uuid])),
  'several items are counted in one call');
select test.check((select count(*) = 3 from public.kb_passages where item_id = 'b7200001-0000-0000-0000-000000000001'),
  'reviewers still read passages');
do $$
begin
  perform * from public.library_item_counts(array_fill('b7200001-0000-0000-0000-000000000001'::uuid, array[501]));
  raise exception 'FAILED: at most 500 items at a time (was allowed)';
exception when invalid_parameter_value then
  raise notice 'ok - at most 500 items at a time (refused)';
end $$;
reset role;

select test.as_user('a7200002-0000-0000-0000-000000000002');
select test.refused($$select * from public.library_item_counts(array['b7200001-0000-0000-0000-000000000001'::uuid])$$,
  'students cannot get library counts');
select test.check((select count(*) = 0 from public.kb_passages), 'students still read no passages');
select test.check((select count(*) = 0 from public.kb_item_pages), 'students still read no page text');
select test.check((select count(*) = 0 from public.kb_items where title like 'Counts%'), 'students still do not see unapproved items');
reset role;

select test.as_anon();
select test.refused($$select * from public.library_item_counts(array['b7200001-0000-0000-0000-000000000001'::uuid])$$,
  'visitors cannot get library counts');
reset role;
