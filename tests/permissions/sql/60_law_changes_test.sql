-- Permission tests at database level: changes in the law and the out-of-date warning (step 2f).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000043', 'student5@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000044', 'reviewer5@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000045', 'admin5@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000044';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000045';

-- Two Civil Litigation items, checked to different dates, and one Criminal Litigation item.
select test.as_user('eeeeeeee-0000-0000-0000-000000000045');
insert into public.kb_items (title, type, course_id)
  select t, 'note', id from (values ('Currency old'), ('Currency new')) v(t), public.courses where slug = 'civil-litigation';
insert into public.kb_items (title, type, course_id)
  select 'Currency criminal', 'note', id from public.courses where slug = 'criminal-litigation';
update public.kb_items set law_current_as_of = '2023-06-30' where title in ('Currency old', 'Currency criminal');
update public.kb_items set law_current_as_of = '2024-09-30' where title = 'Currency new';
reset role;

-- A reviewer records a change in Civil Litigation ---------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000044');
insert into public.law_changes (course_id, title, effective_on)
  select id, 'Rules amended: Order 2', '2024-03-01' from public.courses where slug = 'civil-litigation';
select test.check(
  (select array_agg(i.title order by i.title) from public.kb_items_needing_recheck r
     join public.kb_items i on i.id = r.item_id) = array['Currency old'],
  'only items checked before the change, in the same course, need re-checking');
select test.check(
  (select change_title from public.kb_items_needing_recheck limit 1) = 'Rules amended: Order 2',
  'the warning names the change');

-- Re-checking to a later date clears the warning --------------------------------
update public.kb_items set law_current_as_of = '2024-06-01' where title = 'Currency old';
select test.check((select count(*) from public.kb_items_needing_recheck) = 0, 'a newer "current as of" date clears the warning');

-- Reviewers may correct and remove their records --------------------------------
update public.law_changes set effective_on = '2024-12-01' where title = 'Rules amended: Order 2';
select test.check((select count(*) from public.kb_items_needing_recheck) = 2, 'moving the change date re-applies the warning');
select test.refused(
  $$update public.law_changes set course_id = (select id from public.courses where slug = 'criminal-litigation')$$,
  'a change cannot be moved to another course (remove and record it again)');
reset role;

select test.check(
  (select count(*) from public.audit_log where action = 'library.law_change_added') = 1
  and (select count(*) from public.audit_log where action = 'library.law_change_corrected') = 1,
  'recording and correcting a change are recorded');

-- Students and visitors see nothing ------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000043');
select test.check((select count(*) from public.law_changes) = 0, 'students cannot see law changes');
select test.check((select count(*) from public.kb_items_needing_recheck) = 0, 'students cannot see the warnings');
select test.refused(
  $$insert into public.law_changes (course_id, title, effective_on) select id, 'Fake', '2025-01-01' from public.courses limit 1$$,
  'students cannot record law changes');
reset role;
select test.as_anon();
select test.refused($$select * from public.law_changes$$, 'visitors cannot read law changes');
select test.refused($$select * from public.kb_items_needing_recheck$$, 'visitors cannot read the warnings');
reset role;

-- A reviewer removes the change; the warning goes with it ---------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000044');
delete from public.law_changes where title = 'Rules amended: Order 2';
select test.check((select count(*) from public.kb_items_needing_recheck) = 0, 'removing a change removes its warnings');
reset role;
select test.check(
  (select count(*) from public.audit_log where action = 'library.law_change_removed') = 1,
  'removing a change is recorded');

select test.check(true, 'Law change permission tests passed.');
