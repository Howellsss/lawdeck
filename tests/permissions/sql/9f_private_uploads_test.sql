-- Permission tests at database level: students' private uploads (migration 24).
-- Phase 6 exit check: a second student can never retrieve, see or be answered from another
-- student's upload (PRD UP-02). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000241', 'studentA241@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000242', 'studentB242@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000243', 'reviewer243@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000244', 'admin244@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000243';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000244';

-- Before the notice: nothing can be uploaded ------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000241');
select test.check(not public.upload_notice_accepted(), 'a new student has not accepted the upload notice');
select test.refused($$insert into storage.objects (bucket_id, name) values ('uploads', 'cccccccc-0000-0000-0000-000000000241/a.pdf')$$,
  'no file can be stored before the notice is accepted');
reset role;
do $$
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000241');
  begin
    insert into public.uploads (file_name, mime_type, size_bytes, storage_path)
      values ('notes.pdf', 'application/pdf', 1000, 'cccccccc-0000-0000-0000-000000000241/a.pdf');
    raise exception 'FAILED: an upload was recorded before the notice was accepted';
  exception when insufficient_privilege then
    raise notice 'ok - no upload is recorded before the notice is accepted (refused)';
  end;
  reset role;
end $$;

-- Student A accepts the notice and uploads ------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000241');
select public.accept_upload_notice();
select test.check(public.upload_notice_accepted(), 'accepting the notice is recorded');
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000241');
select test.check((select public.accept_upload_notice()) = (select upload_notice_accepted_at from public.profiles),
  'accepting again keeps the first time');
select test.refused($$update public.profiles set upload_notice_accepted_at = null$$, 'a student cannot change the notice record directly');
insert into storage.objects (bucket_id, name) values ('uploads', 'cccccccc-0000-0000-0000-000000000241/a.pdf');
insert into public.uploads (file_name, mime_type, size_bytes, storage_path)
  values ('Quokka notes.pdf', 'application/pdf', 1000, 'cccccccc-0000-0000-0000-000000000241/a.pdf');
insert into public.upload_passages (upload_id, position, text)
  select id, 0, 'My own notes on quokka writs.' from public.uploads;
select test.check((select count(*) from public.uploads) = 1, 'a student records their upload');
select test.check((select status from public.uploads) = 'processing', 'a new upload waits to be read');
select test.check((select count(*) from public.upload_passages) = 1, 'a student sees their own passages');
select test.refused($$insert into storage.objects (bucket_id, name) values ('uploads', 'cccccccc-0000-0000-0000-000000000242/sneaky.pdf')$$,
  'a student cannot put a file in another student''s folder');
select test.refused($$insert into storage.objects (bucket_id, name) values ('uploads', 'a.pdf')$$,
  'a file must go inside the student''s own folder');
select test.refused($$insert into public.uploads (file_name, mime_type, size_bytes, storage_path)
  values ('x.pdf', 'application/pdf', 10, 'cccccccc-0000-0000-0000-000000000242/x.pdf')$$,
  'an upload record must point inside the student''s own folder');
select test.refused($$insert into public.uploads (file_name, mime_type, size_bytes, storage_path)
  values ('x.exe', 'application/x-msdownload', 10, 'cccccccc-0000-0000-0000-000000000241/x.exe')$$,
  'only PDF, Word and image files are accepted');
select test.refused($$insert into public.uploads (file_name, mime_type, size_bytes, storage_path)
  values ('big.pdf', 'application/pdf', 26214401, 'cccccccc-0000-0000-0000-000000000241/big.pdf')$$,
  'files over 25 MB are refused');
select test.refused($$update public.uploads set status = 'ready'$$, 'a student cannot mark their own file as read');
reset role;

-- Student B sees and touches none of it ----------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000242');
select public.accept_upload_notice();
select test.check((select count(*) from storage.objects where bucket_id = 'uploads') = 0, 'another student cannot see the file');
select test.check((select count(*) from public.uploads) = 0, 'another student cannot see the upload');
select test.check((select count(*) from public.upload_passages) = 0, 'another student cannot see its passages');
delete from storage.objects where bucket_id = 'uploads';
delete from public.uploads;
delete from public.upload_passages;
reset role;
select test.check((select count(*) from storage.objects where bucket_id = 'uploads') = 1, 'another student cannot delete the file');
select test.check((select count(*) from public.uploads) + (select count(*) from public.upload_passages) = 2,
  'another student cannot delete the upload or its passages');

do $$
declare a_upload uuid := (select id from public.uploads limit 1);
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000242');
  begin
    execute format('insert into public.upload_passages (upload_id, position, text) values (%L, 1, %L)', a_upload, 'Planted text');
    raise exception 'FAILED: another student added a passage to the upload';
  exception when foreign_key_violation or insufficient_privilege then
    raise notice 'ok - another student cannot add passages to someone else''s upload (refused)';
  end;
  reset role;
end $$;

-- Staff and visitors never see students' uploads ------------------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000243');
select test.check((select count(*) from public.uploads) + (select count(*) from public.upload_passages) = 0,
  'reviewers cannot see students'' uploads');
select test.check((select count(*) from storage.objects where bucket_id = 'uploads') = 0, 'reviewers cannot see students'' files');
reset role;
select test.as_user('eeeeeeee-0000-0000-0000-000000000244');
select test.check((select count(*) from public.uploads) = 0, 'admins cannot see students'' uploads');
select test.check((select count(*) from storage.objects where bucket_id = 'uploads') = 0, 'admins cannot see students'' files');
reset role;
select test.as_anon();
select test.refused($$select * from public.uploads$$, 'visitors cannot read uploads');
select test.refused($$select * from public.upload_passages$$, 'visitors cannot read upload passages');
reset role;

-- The plan's file limit (Free: 50) ----------------------------------------------------------
do $$
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000241');
  for i in 2..50 loop
    insert into public.uploads (file_name, mime_type, size_bytes, storage_path)
      values ('n.pdf', 'application/pdf', 10, format('cccccccc-0000-0000-0000-000000000241/%s.pdf', i));
  end loop;
  begin
    insert into public.uploads (file_name, mime_type, size_bytes, storage_path)
      values ('n.pdf', 'application/pdf', 10, 'cccccccc-0000-0000-0000-000000000241/51.pdf');
    raise exception 'FAILED: a 51st file was accepted on the Free plan';
  exception when check_violation then
    raise notice 'ok - the Free plan stops at 50 files (refused)';
  end;
  reset role;
end $$;

-- Deleting an upload removes its passages; the owner can remove the file ------------------
select test.as_user('cccccccc-0000-0000-0000-000000000241');
delete from storage.objects where name = 'cccccccc-0000-0000-0000-000000000241/a.pdf';
delete from public.uploads where storage_path = 'cccccccc-0000-0000-0000-000000000241/a.pdf';
select test.check((select count(*) from public.upload_passages) = 0, 'deleting an upload removes its passages');
select test.check((select count(*) from storage.objects where bucket_id = 'uploads') = 0, 'a student removes their own file');
reset role;
