-- Permission tests at database level: the search limit (migration 10).
-- Students: 40 searches an hour (and 200 a day); then refused. Reviewers, admins and the marked
-- admin job are not limited. Nobody can write or wipe their own search record directly, and
-- nobody can see another person's searches.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000071', 'student71@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000072', 'student72@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000073', 'reviewer73@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000073';

create table test.limit_course as select id as course_id from public.courses where slug = 'civil-litigation';
grant select on test.limit_course to authenticated, anon;

-- Runs one search as the current person; true when it was allowed.
create function test.try_search() returns boolean language plpgsql as $$
begin
  perform * from public.search_library('limit check', (select course_id from test.limit_course));
  return true;
exception when sqlstate 'LD429' then
  return false;
end $$;
grant execute on function test.try_search() to authenticated;

-- A student uses up the hour --------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000071');
select test.check((select bool_and(test.try_search()) from generate_series(1, 40)), 'a student can search 40 times in an hour');
select test.check(not test.try_search(), 'the 41st search in the hour is refused');
select test.check((select count(*) from public.search_events) = 40, 'a student sees their own searches');
select test.refused('insert into public.search_events (owner_id) values (''cccccccc-0000-0000-0000-000000000072'')',
  'a student cannot add search records');
select test.refused('delete from public.search_events', 'a student cannot delete search records');
reset role;
select test.check((select count(*) from public.search_events where owner_id = 'cccccccc-0000-0000-0000-000000000071') = 40,
  'a student cannot wipe their own searches to get round the limit');

-- Another student is not affected, and cannot see the first one's searches -----
select test.as_user('cccccccc-0000-0000-0000-000000000072');
select test.check(test.try_search(), 'one student''s limit does not affect another');
select test.check((select count(*) from public.search_events) = 1, 'a student cannot see other people''s searches');
reset role;

-- The daily limit: 200 searches spread over the day ---------------------------
insert into public.search_events (owner_id, created_at)
  select 'cccccccc-0000-0000-0000-000000000072', now() - interval '2 hours' - n * interval '1 minute'
  from generate_series(1, 199) n;
select test.as_user('cccccccc-0000-0000-0000-000000000072');
select test.check(not test.try_search(), 'after 200 searches in a day, the next is refused');
reset role;

-- Old searches stop counting ----------------------------------------------------
update public.search_events set created_at = now() - interval '3 hours'
  where owner_id = 'cccccccc-0000-0000-0000-000000000071';
select test.as_user('cccccccc-0000-0000-0000-000000000071');
select test.check(test.try_search(), 'searches older than an hour no longer count towards the hourly limit');
reset role;

-- Reviewers and the admin job are not limited -----------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000073');
select test.check((select bool_and(test.try_search()) from generate_series(1, 45)), 'reviewers are not limited');
select test.check((select count(*) from public.search_events) = 0, 'reviewer searches are not recorded');
reset role;
set role service_role;
select count(*) >= 0 as job_ok
  from public.search_library('limit check', (select id from public.courses where slug = 'civil-litigation')) \gset
reset role;
select test.check(:'job_ok'::boolean, 'the admin job is not limited');
