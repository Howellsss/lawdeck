-- Database tests: PowerPoint slides and large files in the library (migration 69). The library
-- store and its archive take files up to 100 MB, PowerPoint included; students' own uploads
-- keep 25 MB and no slides.
\set ON_ERROR_STOP on
\set QUIET on

select test.check(
  (select bool_and(file_size_limit = 104857600) from storage.buckets where id in ('library', 'library-archive')),
  'the library store and its archive take files up to 100 MB');
select test.check(
  (select bool_and('application/vnd.openxmlformats-officedocument.presentationml.presentation' = any (allowed_mime_types))
     from storage.buckets where id in ('library', 'library-archive')),
  'the library store and its archive accept PowerPoint');
select test.check(
  (select file_size_limit = 26214400 from storage.buckets where id = 'uploads'),
  'students'' own uploads still stop at 25 MB');
select test.check(
  (select not ('application/vnd.openxmlformats-officedocument.presentationml.presentation' = any (allowed_mime_types))
     from storage.buckets where id = 'uploads'),
  'students cannot upload PowerPoint');
select test.check(
  (select pg_get_constraintdef(c.oid) like '%104857600%' from pg_constraint c
    where c.conrelid = 'public.kb_items'::regclass and c.conname = 'kb_items_size_bytes_check'),
  'library items may record files up to 100 MB');
select test.check(
  (select count(*) = 0 from pg_constraint c
    where c.conrelid = 'public.kb_items'::regclass and pg_get_constraintdef(c.oid) like '%26214400%'),
  'the old 25 MB limit on library items is gone');
