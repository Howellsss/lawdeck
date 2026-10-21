-- Permission tests at database level: searching the library (step 2d).
-- Students get at most 30 approved passages (8 before migration 10) of the chosen course; never pending, rejected,
-- withdrawn or other courses' material. Reviewers may include material awaiting review.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000023', 'student3@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000024', 'reviewer3@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000025', 'admin3@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000024';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000025';

-- A search vector with a single 1 at the given place (made-up vectors for the tests).
create function test.vec(hot integer) returns extensions.vector language sql immutable as $$
  select ('[' || array_to_string(array(select case when i = hot then 1 else 0 end from generate_series(1, 1024) i), ',') || ']')::extensions.vector
$$;
grant execute on function test.vec(integer) to authenticated, anon;

-- The admin adds items in every state ------------------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000025');
insert into public.kb_items (title, type, course_id)
  select t, 'note', c.id
  from (values ('Search approved'), ('Search pending'), ('Search withdrawn'), ('Search rejected')) v(t),
       public.courses c where c.slug = 'civil-litigation';
insert into public.kb_items (title, type, course_id)
  select 'Search other course', 'note', id from public.courses where slug = 'criminal-litigation';
insert into public.kb_passages (item_id, position, text)
  select id, 0, 'Zebra marker words about ' || title from public.kb_items where title like 'Search %';
-- Forty more approved passages, to test the limit of 30 (migration 10).
insert into public.kb_passages (item_id, position, text)
  select id, n, 'Zebra marker extra passage ' || n from public.kb_items, generate_series(1, 40) n
  where title = 'Search approved';
select test.make_reviewable('Search %');
update public.kb_items set review_status = 'approved' where title in ('Search approved', 'Search other course');
update public.kb_items set review_status = 'withdrawn' where title = 'Search withdrawn';
update public.kb_items set review_status = 'rejected' where title = 'Search rejected';
reset role;

-- Search vectors are written by the marked admin job (here: the database owner).
update public.kb_passages p set embedding = test.vec(1), embedding_model = 'model-a'
  from public.kb_items i where i.id = p.item_id and i.title like 'Search %' and p.position = 0;
update public.kb_passages p set embedding = test.vec(2), embedding_model = 'model-a'
  from public.kb_items i where i.id = p.item_id and i.title = 'Search approved' and p.position > 0;

create table test.search as select id as course_id from public.courses where slug = 'civil-litigation';
grant select on test.search to authenticated, anon;

-- A student --------------------------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000023');
select test.check(
  (select count(*) from public.search_library('zebra marker', (select course_id from test.search), null, null, 100)) = 30,
  'students get at most 30 passages, however many they ask for');
select test.check(
  (select bool_and(item_title = 'Search approved')
     from public.search_library('zebra marker', (select course_id from test.search), test.vec(1), 'model-a')),
  'students only ever get approved passages of the chosen course');
select test.check(
  (select item_title from public.search_library('unrelated', (select course_id from test.search), test.vec(1), 'model-a') limit 1)
    = 'Search approved',
  'search by meaning finds the closest approved passage even with no matching words');
select test.check(
  (select text from public.search_library('zebra', (select course_id from test.search), test.vec(1), 'model-a') limit 1)
    = 'Zebra marker words about Search approved',
  'a passage found both ways ranks first');
select test.check(
  (select count(*) from public.search_library('unrelated', (select course_id from test.search), test.vec(1), 'model-b')) = 0,
  'search vectors from a different model are never compared');
select test.check(
  (select count(*) from public.search_library('pending withdrawn rejected other', (select course_id from test.search))) = 0,
  'pending, withdrawn, rejected and other courses'' passages are never found');
select test.refused(
  format('select * from public.search_library(%L, %L, null, null, 8, true)', 'zebra', (select course_id from test.search)),
  'students cannot search material awaiting review');
do $$
begin
  perform * from public.search_library(repeat('a', 2001), (select course_id from test.search));
  raise exception 'FAILED: very long questions are refused (was allowed)';
exception when invalid_parameter_value then
  raise notice 'ok - very long questions are refused (refused)';
end $$;
reset role;

-- A reviewer -------------------------------------------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000024');
select test.check(
  (select count(*) from public.search_library('zebra pending', (select course_id from test.search), null, null, 8, true)
    where item_title = 'Search pending') = 1,
  'reviewers can include material awaiting review');
select test.check(
  (select count(*) from public.search_library('zebra', (select course_id from test.search), test.vec(1), 'model-a', 8, true)
    where item_title in ('Search withdrawn', 'Search rejected', 'Search other course')) = 0,
  'even reviewers never get withdrawn, rejected or other courses'' passages');
select test.refused(
  $$update public.kb_items set indexed_passages = 99 where title = 'Search approved'$$,
  'reviewers cannot change search index details');
reset role;

-- Visitors ---------------------------------------------------------------------
select test.as_anon();
select test.refused(
  format('select * from public.search_library(%L, %L)', 'zebra', (select course_id from test.search)),
  'visitors cannot search');
reset role;

-- The marked admin job (service key), used by the retrieval test ---------------
set role service_role;
select (count(*) = 1) as service_job_ok
  from public.search_library('zebra pending', (select id from public.courses where slug = 'civil-litigation'), null, null, 8, true)
  where item_title = 'Search pending' \gset
reset role;
select test.check(:'service_job_ok'::boolean, 'the admin job can search, including material awaiting review');

-- Replacing passages clears the index count ------------------------------------
update public.kb_items set indexed_passages = 11, index_model = 'model-a', indexed_at = now() where title = 'Search approved';
select test.as_user('eeeeeeee-0000-0000-0000-000000000025');
select public.replace_kb_passages(
  (select id from public.kb_items where title = 'Search approved'), '[{"text": "New wording"}]'::jsonb, 'text', 1, 1);
select test.check(
  (select indexed_passages = 0 and index_model is null and indexed_at is null from public.kb_items where title = 'Search approved'),
  'new passages start without search vectors');
delete from public.kb_items where title like 'Search %';
reset role;

select test.check(true, 'Library search permission tests passed.');
