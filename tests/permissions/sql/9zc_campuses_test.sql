-- Permission tests at database level: campuses and each student's campus (migration 54).
-- Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c54001-0000-0000-0000-000000000001', 'studentA54@test.invalid'),
  ('a5c54002-0000-0000-0000-000000000002', 'studentB54@test.invalid');

select test.as_user('a5c54001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.campuses where kind = 'campus') >= 7, 'a student can read the list of campuses');
select test.check((select count(*) from public.campuses where key = 'aspirant') = 1, 'with "Law School aspirant" as a choice');
update public.profiles set campus = 'lagos' where id = 'a5c54001-0000-0000-0000-000000000001';
select test.check((select campus = 'lagos' from public.profiles where id = 'a5c54001-0000-0000-0000-000000000001'), 'a student sets their own campus');
select test.refused($$update public.profiles set campus = 'atlantis' where id = 'a5c54001-0000-0000-0000-000000000001'$$,
  'only a campus on the list');
update public.profiles set campus = null where id = 'a5c54001-0000-0000-0000-000000000001';
select test.check((select campus is null from public.profiles where id = 'a5c54001-0000-0000-0000-000000000001'), 'and can clear it');
select test.refused($$insert into public.campuses (key, name, position) values ('mars', 'Mars', 50)$$, 'students cannot add a campus');
select test.refused($$update public.campuses set name = 'Renamed'$$, 'or rename one');
update public.profiles set campus = 'kano' where id = 'a5c54002-0000-0000-0000-000000000002';
reset role;
select test.check((select campus is null from public.profiles where id = 'a5c54002-0000-0000-0000-000000000002'),
  'a student cannot set someone else''s campus');

select test.as_anon();
select test.refused($$select count(*) from public.campuses$$, 'visitors cannot read the campus list');
reset role;
