-- Permission tests at database level: reading library files (step 2c).
-- Students: no page text, no passages, cannot replace passages.
-- Reviewers: read page text; cannot change reading details or replace passages.
-- Admins: add page text and replace an item's passages in one step.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000013', 'student2@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000014', 'reviewer2@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000015', 'admin2@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000014';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000015';

-- The admin adds an approved item, reads one page and stores its passages ----------
select test.as_user('eeeeeeee-0000-0000-0000-000000000015');
insert into public.kb_items (title, type, course_id)
  select 'Read note', 'note', id from public.courses where slug = 'civil-litigation';
select test.check(
  (select reading_status from public.kb_items where title = 'Read note') = 'waiting',
  'a new item is waiting to be read');
select test.make_reviewable('Read note');
update public.kb_items set review_status = 'approved' where title = 'Read note';
insert into public.kb_item_pages (item_id, page, text, method)
  select id, 1, 'Page one text', 'text' from public.kb_items where title = 'Read note';
insert into public.kb_passages (item_id, position, text)
  select id, 0, 'An old passage' from public.kb_items where title = 'Read note';
select test.check(
  public.replace_kb_passages(
    (select id from public.kb_items where title = 'Read note'),
    '[{"heading": "First", "text": "One", "pageFrom": 1, "pageTo": 1},
      {"heading": "", "text": "Two", "pageFrom": 1, "pageTo": 2}]'::jsonb,
    'text', 0.9, 2) = 2,
  'admins replace an item''s passages');
select test.check(
  (select count(*) from public.kb_passages p join public.kb_items i on i.id = p.item_id
    where i.title = 'Read note') = 2
  and not exists (select 1 from public.kb_passages where text = 'An old passage'),
  'old passages are removed when the new ones are stored');
select test.check(
  (select heading is null and page_to = 2 from public.kb_passages where text = 'Two'),
  'empty headings are stored as none, and page numbers are kept');
select test.check(
  (select reading_status = 'done' and reading_method = 'text' and reading_quality = 0.9
          and page_count = 2 and read_at is not null
     from public.kb_items where title = 'Read note'),
  'replacing passages marks the item as read, with method, quality and pages');
reset role;

create table test.reading as select id as item_id from public.kb_items where title = 'Read note';
grant select on test.reading to authenticated, anon;

-- A student --------------------------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000013');
select test.check((select count(*) from public.kb_item_pages) = 0, 'students cannot read page text, even of approved items');
select test.refused(
  format('insert into public.kb_item_pages (item_id, page, text, method) values (%L, 2, %L, %L)',
    (select item_id from test.reading), 'fake', 'text'),
  'students cannot add page text');
select test.refused(
  format('select public.replace_kb_passages(%L, %L::jsonb, %L, 1, 1)',
    (select item_id from test.reading), '[{"text": "fake"}]', 'text'),
  'students cannot replace passages');
reset role;

-- A reviewer -------------------------------------------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000014');
select test.check((select count(*) from public.kb_item_pages) >= 1, 'reviewers read page text');
select test.refused(
  format('update public.kb_items set reading_status = %L where id = %L', 'failed', (select item_id from test.reading)),
  'reviewers cannot change reading details');
select test.refused(
  format('select public.replace_kb_passages(%L, %L::jsonb, %L, 1, 1)',
    (select item_id from test.reading), '[{"text": "fake"}]', 'text'),
  'reviewers cannot replace passages');
delete from public.kb_item_pages;
select test.check((select count(*) from public.kb_item_pages) >= 1, 'reviewers cannot delete page text');
reset role;

-- Visitors ---------------------------------------------------------------------
select test.as_anon();
select test.refused($$select * from public.kb_item_pages$$, 'visitors cannot read page text');
reset role;

-- Bad input and removal --------------------------------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000015');
select test.refused(
  format('select public.replace_kb_passages(%L, %L::jsonb, %L, 1, 1)', (select item_id from test.reading), '[{"text": ""}]', 'text'),
  'a passage with no text is refused');
select test.check(
  (select count(*) from public.kb_passages where item_id = (select item_id from test.reading)) = 2,
  'a refused replacement leaves the earlier passages in place');
delete from public.kb_items where title = 'Read note';
select test.check((select count(*) from public.kb_item_pages) = 0, 'removing an item removes its page text');
reset role;

select test.check(true, 'Library reading permission tests passed.');
