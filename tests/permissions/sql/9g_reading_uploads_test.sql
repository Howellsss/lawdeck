-- Permission tests at database level: reading students' uploads (migration 25). Made-up names.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000251', 'studentA251@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000252', 'studentB252@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000253', 'reviewer253@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000253';

select test.as_user('cccccccc-0000-0000-0000-000000000251');
select public.accept_upload_notice();
insert into public.uploads (file_name, mime_type, size_bytes, storage_path)
  values ('Wombat notes.pdf', 'application/pdf', 1000, 'cccccccc-0000-0000-0000-000000000251/w.pdf');
reset role;
create table test.upload_reading as select id from public.uploads where file_name = 'Wombat notes.pdf';
grant select on test.upload_reading to authenticated;

-- The owner reads the file: page text, passages, then Ready ----------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000251');
select public.restart_upload_reading((select id from test.upload_reading));
select public.set_upload_page_count((select id from test.upload_reading), 2);
insert into public.upload_pages (upload_id, page, text, method) select id, 1, 'Page one about wombats.', 'text' from test.upload_reading;
insert into public.upload_pages (upload_id, page, text, method) select id, 2, 'Page two, scanned.', 'scan' from test.upload_reading;
select test.check((select count(*) from public.upload_pages) = 2, 'the owner stores page text');
select test.refused($$select public.finish_upload_reading((select id from test.upload_reading))$$,
  'a file cannot be marked Ready before it has passages');
select test.check((select public.replace_upload_passages((select id from test.upload_reading),
  '[{"heading": "Wombats", "text": "Wombats dig.", "pageFrom": 1, "pageTo": 2}]', 0.75, 2)) = 1,
  'the owner saves the file''s passages');
select test.check((select status from public.uploads) = 'processing', 'saving passages alone does not mark the file Ready');
update public.upload_passages set embedding_model = 'test-model';
select test.check((select embedding_model from public.upload_passages) = 'test-model', 'the owner gives their passages search vectors');
select test.refused($$update public.upload_passages set text = 'changed'$$, 'passage wording cannot be changed directly');
select public.finish_upload_reading((select id from test.upload_reading));
select test.check((select status = 'ready' and ocr_confidence = 0.75 and page_count = 2 from public.uploads),
  'a read file is Ready with its quality and page count');
select test.refused($$update public.uploads set status = 'failed'$$, 'a student still cannot set the status directly');
reset role;

-- Student B and staff cannot touch any of it ------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000252');
select test.check((select count(*) from public.upload_pages) = 0, 'another student cannot see the page text');
select test.refused($$select public.restart_upload_reading((select id from test.upload_reading))$$, 'another student cannot restart the reading');
select test.refused($$select public.replace_upload_passages((select id from test.upload_reading), '[{"text": "planted"}]', 1, 1)$$,
  'another student cannot replace the passages');
select test.refused($$select public.finish_upload_reading((select id from test.upload_reading))$$, 'another student cannot finish the reading');
select test.refused($$select public.fail_upload_reading((select id from test.upload_reading), 'sabotage')$$, 'another student cannot fail the reading');
select test.refused($$select public.set_upload_page_count((select id from test.upload_reading), 9)$$, 'another student cannot change the page count');
update public.upload_passages set embedding_model = 'hijacked';
delete from public.upload_pages;
reset role;
select test.check((select embedding_model from public.upload_passages) = 'test-model', 'another student cannot change the search vectors');
select test.check((select count(*) from public.upload_pages) = 2, 'another student cannot delete the page text');
do $$
declare a_upload uuid := (select id from test.upload_reading);
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000252');
  begin
    execute format('insert into public.upload_pages (upload_id, page, text, method) values (%L, 3, %L, %L)', a_upload, 'planted', 'text');
    raise exception 'FAILED: another student added page text';
  exception when foreign_key_violation or insufficient_privilege then
    raise notice 'ok - another student cannot add page text to someone else''s upload (refused)';
  end;
  reset role;
end $$;
select test.as_user('dddddddd-0000-0000-0000-000000000253');
select test.check((select count(*) from public.upload_pages) = 0, 'reviewers cannot see students'' page text');
reset role;

-- A failure is recorded with its reason; restarting clears it -------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000251');
select public.fail_upload_reading((select id from test.upload_reading), 'Too many scanned pages this month.');
select test.check((select status = 'failed' and problem = 'Too many scanned pages this month.' from public.uploads), 'a failure is recorded with its reason');
select public.restart_upload_reading((select id from test.upload_reading));
select test.check((select status = 'processing' and problem is null from public.uploads)
  and (select count(*) from public.upload_pages) + (select count(*) from public.upload_passages) = 0,
  'reading again starts afresh');
reset role;

-- The scanned-page allowance (Free: 200 a month) -------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000251');
select test.check(public.scan_pages_left() = 200, 'a student starts the month with 200 scanned pages');
select public.record_scan_pages(3);
select test.check(public.scan_pages_left() = 197, 'scanned pages read are counted');
select test.refused($$delete from public.scan_page_usage$$, 'a student cannot wipe their scan count') ;
select test.check(public.scan_pages_left() = 197, 'the scan count survives an attempt to delete it');
select test.refused($$insert into public.scan_page_usage (owner_id, pages) values ('cccccccc-0000-0000-0000-000000000251', 1)$$,
  'a student cannot write the scan count directly');
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000252');
select test.check(public.scan_pages_left() = 200, 'one student''s scans do not use another''s allowance');
select test.check((select count(*) from public.scan_page_usage) = 0, 'a student cannot see another''s scan count');
reset role;
select test.as_user('dddddddd-0000-0000-0000-000000000253');
select test.check(public.scan_pages_left() is null, 'reviewers have no scan limit');
reset role;

-- Deleting the upload removes its page text --------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000251');
insert into public.upload_pages (upload_id, page, text, method) select id, 1, 'Again.', 'text' from test.upload_reading;
delete from public.uploads;
select test.check((select count(*) from public.upload_pages) = 0, 'deleting an upload removes its page text');
select test.check(public.scan_pages_left() = 197, 'deleting a file does not give its scanned pages back');
reset role;
