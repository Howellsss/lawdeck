-- Permission tests at database level: records of accepting the Terms and Privacy Notice (migration 67).
-- Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c67001-0000-0000-0000-000000000001', 'ada67@test.invalid'),
  ('a5c67002-0000-0000-0000-000000000002', 'bola67@test.invalid'),
  ('a5c67003-0000-0000-0000-000000000003', 'admin67@test.invalid');
update public.profiles set role = 'admin' where id = 'a5c67003-0000-0000-0000-000000000003';

select test.as_user('a5c67001-0000-0000-0000-000000000001');
insert into public.terms_acceptances (terms_version) values ('2026-11-13');
select test.check((select owner_id = 'a5c67001-0000-0000-0000-000000000001' and accepted_at > now() - interval '1 minute'
  from public.terms_acceptances), 'a student records their own acceptance, owner and time set by the database');
select test.refused($$insert into public.terms_acceptances (terms_version, owner_id) values ('v2', 'a5c67002-0000-0000-0000-000000000002')$$,
  'nobody records an acceptance for someone else');
select test.refused($$insert into public.terms_acceptances (terms_version, accepted_at) values ('v3', '2020-01-01')$$,
  'nobody backdates an acceptance');
select test.refused($$update public.terms_acceptances set terms_version = 'changed'$$, 'a student cannot change their record');
select test.refused($$delete from public.terms_acceptances$$, 'or delete it');
reset role;
select test.check((select count(*) = 1 and bool_and(terms_version = '2026-11-13') from public.terms_acceptances
  where owner_id = 'a5c67001-0000-0000-0000-000000000001'), 'a record cannot be changed or deleted');

select test.as_user('a5c67002-0000-0000-0000-000000000002');
select test.check((select count(*) = 0 from public.terms_acceptances), 'another student cannot see it');
reset role;

select test.as_user('a5c67003-0000-0000-0000-000000000003');
select test.check((select count(*) = 1 from public.terms_acceptances), 'an admin can see it, as evidence');
reset role;

select test.as_anon();
select test.refused($$select * from public.terms_acceptances$$, 'signed-out visitors cannot read records');
select test.refused($$insert into public.terms_acceptances (terms_version) values ('x')$$, 'or add them');
reset role;

delete from auth.users where id = 'a5c67001-0000-0000-0000-000000000001';
select test.check(not exists (select 1 from public.terms_acceptances where owner_id = 'a5c67001-0000-0000-0000-000000000001'),
  'records go with a deleted account');
