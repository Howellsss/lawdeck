-- Permission tests at database level: unusual-access warnings (migration 31, rule P-03).
-- Downloads are recorded only for the signed-in person; nobody reads them directly; only the
-- marked admin job (service key) can run the hourly summary, which holds counts only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000501', 'studentA501@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000502', 'admin502@test.invalid');
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000502';

select test.as_user('cccccccc-0000-0000-0000-000000000501');
select public.record_download('document_docx');
select public.record_download('document_docx');
select public.record_download('study_export');
select test.refused($$select count(*) from public.download_events$$, 'students cannot read the download log');
select test.refused($$insert into public.download_events (owner_id, kind) values ('cccccccc-0000-0000-0000-000000000501', 'study_export')$$,
  'students cannot write the download log directly');
select test.refused($$select * from public.unusual_activity(60)$$, 'students cannot run the unusual-activity summary');
do $$
begin
  perform public.record_download('everything');
  raise exception 'FAIL - an unknown kind of download is refused';
exception when invalid_parameter_value then
  raise notice 'ok - an unknown kind of download is refused';
end;
$$;
reset role;

select test.as_user('eeeeeeee-0000-0000-0000-000000000502');
select test.refused($$select * from public.unusual_activity(60)$$, 'admins in the app cannot run it either (admin job only)');
reset role;

select test.as_anon();
select test.refused($$select public.record_download('document_docx')$$, 'visitors cannot record downloads');
select test.refused($$select * from public.unusual_activity(60)$$, 'visitors cannot run the summary');
reset role;

-- The admin job runs it (the test helpers are not visible to that role, so results are read after).
set role service_role;
select (select value from public.unusual_activity(60) where metric = 'most_downloads_by_one_account') as most_downloads,
       (select count(*) from public.unusual_activity(60)) as metrics \gset
reset role;
select test.check(:most_downloads = 3, 'the admin job sees the most downloads by one account');
select test.check(:metrics = 5, 'the summary has five counts, and nothing else');
