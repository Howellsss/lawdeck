-- Database tests: no duplicate library files (migration 71). Each item can record the Drive file it
-- came from and a fingerprint of its contents; both are set once and only by admins (or jobs).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a7100001-0000-0000-0000-000000000001', 'reviewer71@test.invalid'),
  ('a7100002-0000-0000-0000-000000000002', 'admin71@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a7100001-0000-0000-0000-000000000001';
update public.profiles set role = 'admin' where id = 'a7100002-0000-0000-0000-000000000002';

create function test.fp(c text) returns text language sql immutable as $$ select repeat(c, 64) $$;
grant execute on function test.fp(text) to authenticated;

select test.as_user('a7100002-0000-0000-0000-000000000002');
insert into public.kb_items (title, type, course_id, file_name, size_bytes, drive_file_id, content_sha256)
  select 'Dup from drive', 'note', id, 'notes.pdf', 1000, '1AbCdEfGhIjKlMnOp_-Q', test.fp('a')
  from public.courses where slug = 'civil-litigation';
insert into public.kb_items (title, type, course_id, file_name, size_bytes)
  select 'Dup older item', 'note', id, 'older.pdf', 2000 from public.courses where slug = 'civil-litigation';
select test.check(
  (select drive_file_id = '1AbCdEfGhIjKlMnOp_-Q' and content_sha256 = test.fp('a') from public.kb_items where title = 'Dup from drive'),
  'an admin records where a file came from and its fingerprint');
update public.kb_items set content_sha256 = test.fp('b') where title = 'Dup older item';
select test.check((select content_sha256 = test.fp('b') from public.kb_items where title = 'Dup older item'),
  'an older item can be given its fingerprint once');
select test.refused($$update public.kb_items set content_sha256 = repeat('c', 64) where title = 'Dup older item'$$,
  'a fingerprint cannot be changed once set');
select test.refused($$update public.kb_items set drive_file_id = '1ZzZzZzZzZzZzZzZ' where title = 'Dup from drive'$$,
  'where a file came from cannot be changed once set');
select test.refused($$update public.kb_items set content_sha256 = 'not a fingerprint' where title = 'Dup from drive'$$,
  'a fingerprint must look like one');
reset role;

insert into public.kb_items (title, type, course_id) select 'Dup reviewer target', 'note', id from public.courses where slug = 'civil-litigation';
select test.as_user('a7100001-0000-0000-0000-000000000001');
select test.refused($$update public.kb_items set content_sha256 = repeat('d', 64) where title = 'Dup reviewer target'$$,
  'reviewers cannot record fingerprints');
reset role;
