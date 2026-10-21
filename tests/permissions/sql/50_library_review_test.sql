-- Permission tests at database level: reviewing the library (step 2e).
-- Approval needs a read, indexed and dated item; corrections clear the old search vector;
-- every decision, correction, addition and removal is recorded, and students cannot read it.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000033', 'student4@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000034', 'reviewer4@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000035', 'admin4@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000034';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000035';

-- Counts audit records for an item (or one of its passages) and action.
create function test.audits(item_title text, act text) returns bigint language sql security definer as $$
  select count(*) from public.audit_log a
  where a.action = act
    and (a.target_id = (select id from public.kb_items where title = item_title)
         or (a.details ->> 'item_id')::uuid = (select id from public.kb_items where title = item_title));
$$;
grant execute on function test.audits(text, text) to authenticated, anon;

-- The admin adds an item with two passages; adding is recorded ----------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000035');
insert into public.kb_items (title, type, course_id)
  select 'Review note', 'note', id from public.courses where slug = 'civil-litigation';
insert into public.kb_passages (item_id, position, text, embedding, embedding_model)
  select id, n, 'Original wording ' || n,
         ('[' || array_to_string(array_fill(0.1::real, array[1024]), ',') || ']')::extensions.vector, 'voyage-4'
  from public.kb_items, generate_series(0, 1) n where title = 'Review note';
reset role;
select test.check(test.audits('Review note', 'library.item_added') = 1, 'adding an item is recorded');

-- A reviewer cannot approve before the rules are met ------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000034');
select test.refused(
  $$update public.kb_items set review_status = 'approved', law_current_as_of = current_date where title = 'Review note'$$,
  'an unread item cannot be approved');
reset role;
select set_config('request.jwt.claims', '', false); -- back to the database owner (no signed-in user)
update public.kb_items set reading_status = 'done', indexed_passages = 2, indexed_at = now() where title = 'Review note';
select test.as_user('dddddddd-0000-0000-0000-000000000034');
select test.refused(
  $$update public.kb_items set review_status = 'approved' where title = 'Review note'$$,
  'an item cannot be approved without a "current as of" date');
select test.refused(
  $$update public.kb_items set review_status = 'approved', law_current_as_of = current_date + 1 where title = 'Review note'$$,
  'the "current as of" date cannot be in the future');

-- ...and can once they are -------------------------------------------------------
update public.kb_items set review_status = 'approved', law_current_as_of = current_date - 30,
  review_note = 'Checked against the 2024 rules' where title = 'Review note';
reset role;
select test.check(
  (select review_status from public.kb_items where title = 'Review note') = 'approved'
  and (select reviewed_by from public.kb_items where title = 'Review note') = 'dddddddd-0000-0000-0000-000000000034',
  'a reviewer approves a read, indexed and dated item');
select test.check(
  (select count(*) from public.audit_log
    where action = 'library.reviewed' and actor_id = 'dddddddd-0000-0000-0000-000000000034'
      and details ->> 'from' = 'pending' and details ->> 'to' = 'approved') = 1,
  'the decision is recorded with who made it and the change');

-- A reviewer corrects a passage --------------------------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000034');
update public.kb_passages set text = 'Corrected wording'
  where position = 0 and item_id = (select id from public.kb_items where title = 'Review note');
reset role;
select test.check(
  (select embedding is null and embedding_model is null from public.kb_passages
    where position = 0 and item_id = (select id from public.kb_items where title = 'Review note')),
  'a corrected passage loses its old search vector');
select test.check(
  (select embedding is not null from public.kb_passages
    where position = 1 and item_id = (select id from public.kb_items where title = 'Review note')),
  'other passages keep theirs');
select test.check(
  (select indexed_at is null and indexed_passages = 1 from public.kb_items where title = 'Review note'),
  'the item is marked as needing indexing again');
select test.check(test.audits('Review note', 'library.passage_corrected') = 1, 'the correction is recorded');
select test.check(
  not exists (select 1 from public.audit_log where details::text like '%Corrected wording%'),
  'the record never contains the passage text');

-- Reviewers still cannot change an item's details, even after the triggers above ------
select test.as_user('dddddddd-0000-0000-0000-000000000034');
select test.refused(
  $$update public.kb_items set indexed_at = now() where title = 'Review note'$$,
  'reviewers cannot mark an item as indexed themselves');
-- Withdrawing is recorded too.
update public.kb_items set review_status = 'withdrawn' where title = 'Review note';
reset role;
select test.check(test.audits('Review note', 'library.reviewed') = 2, 'withdrawing is recorded');

-- Students cannot read the record --------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000033');
select test.refused($$select * from public.audit_log$$, 'students cannot read the review record');
select test.refused(
  $$insert into public.audit_log (action) values ('fake')$$,
  'students cannot write to the review record');
reset role;

-- The admin removes the item; removal is recorded ----------------------------------
create table test.review_item as select id from public.kb_items where title = 'Review note';
select test.as_user('eeeeeeee-0000-0000-0000-000000000035');
delete from public.kb_items where title = 'Review note';
reset role;
select test.check(
  (select count(*) from public.audit_log
    where action = 'library.item_removed' and target_id = (select id from test.review_item)) = 1,
  'removing an item is recorded');

select test.check(true, 'Library review permission tests passed.');
