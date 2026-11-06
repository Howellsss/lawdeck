-- Permission tests at database level: member counts per chat group (migration 58). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c58001-0000-0000-0000-000000000001', 'lagos58@test.invalid'),
  ('a5c58002-0000-0000-0000-000000000002', 'abuja58@test.invalid'),
  ('a5c58003-0000-0000-0000-000000000003', 'free58@test.invalid'),
  ('a5c58004-0000-0000-0000-000000000004', 'admin58@test.invalid');
update public.profiles set role = 'admin' where id = 'a5c58004-0000-0000-0000-000000000004';
update public.pilot_settings set invite_only = false;
update public.chat_settings set open_to_students = true;
create temporary table g58 as select key, id from public.chat_groups;
grant select on g58 to authenticated;

select test.as_user('a5c58001-0000-0000-0000-000000000001');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'lagos', 'NLS/58/1');
reset role;
select test.as_user('a5c58002-0000-0000-0000-000000000002');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'abuja', 'NLS/58/2');
reset role;
select test.as_user('a5c58004-0000-0000-0000-000000000004');
update public.chat_verifications set status = 'approved' where id_number in ('NLS/58/1', 'NLS/58/2');
reset role;

-- Other test files leave members behind, so counts are checked as changes from here.
select test.as_user('a5c58001-0000-0000-0000-000000000001');
select (select members from public.chat_member_counts() c join g58 on g58.id = c.group_id where g58.key = 'lagos') as lagos0, (select members from public.chat_member_counts() c join g58 on g58.id = c.group_id where g58.key = 'all-campuses') as all0 \gset
insert into public.chat_members default values;
select test.check((select count(*) from public.chat_member_counts()) = 2, 'a student gets counts only for their campus group and All campuses');
select test.check((select members from public.chat_member_counts() c join g58 on g58.id = c.group_id where g58.key = 'lagos') = :lagos0 + 1,
  'a campus group counts its verified members');
select test.check((select members from public.chat_member_counts() c join g58 on g58.id = c.group_id where g58.key = 'all-campuses') = :all0 + 1,
  'verified students who have not accepted the rules are not counted');
reset role;
select test.as_user('a5c58002-0000-0000-0000-000000000002');
select (select members from public.chat_member_counts() c join g58 on g58.id = c.group_id where g58.key = 'abuja') as abuja0 \gset
insert into public.chat_members default values;
select test.check((select members from public.chat_member_counts() c join g58 on g58.id = c.group_id where g58.key = 'all-campuses') = :all0 + 2,
  'All campuses counts members from every campus');
select test.check((select members from public.chat_member_counts() c join g58 on g58.id = c.group_id where g58.key = 'abuja') = :abuja0 + 1,
  'each campus counts only its own students');
reset role;
select test.as_user('a5c58003-0000-0000-0000-000000000003');
select test.check((select count(*) from public.chat_member_counts()) = 0, 'a free account gets no counts');
reset role;

update public.chat_settings set open_to_students = false;
