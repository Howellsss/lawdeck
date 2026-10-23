-- Permission tests at database level: delete account, problem reports, takedown requests
-- (migration 28). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000281', 'studentA281@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000282', 'studentB282@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000283', 'reviewer283@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000283';

-- Student A has a chat with an answer, a brief and a project; B has a project too -------------
select test.as_user('cccccccc-0000-0000-0000-000000000281');
insert into public.projects (name) values ('Numbat file');
insert into public.conversations (title) values ('Numbat chat');
insert into public.briefs (kind, name, sections)
  values ('case', 'Numbat v Bilby', '[{"heading": "Facts", "text": "Made-up facts.", "covered": true}]');
reset role;
-- Answers are written by Lawdeck's server, so the test makes one directly.
insert into public.messages (owner_id, conversation_id, role, content)
  select 'cccccccc-0000-0000-0000-000000000281', id, 'assistant', '{"text": "A numbat writ lasts a year."}'
  from public.conversations where title = 'Numbat chat' and owner_id = 'cccccccc-0000-0000-0000-000000000281';
create table test.numbat as
  select (select id from public.messages where content ->> 'text' like 'A numbat writ%') as answer_id,
         (select id from public.briefs where name = 'Numbat v Bilby') as brief_id;
grant select on test.numbat to authenticated, anon;
select test.as_user('cccccccc-0000-0000-0000-000000000282');
insert into public.projects (name) values ('Bilby file');
reset role;

-- Reports ---------------------------------------------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000281');
insert into public.problem_reports (target_kind, target_id, category, note)
  select 'answer', answer_id, 'wrong_law', 'The period is wrong.' from test.numbat;
insert into public.problem_reports (target_kind, target_id, category)
  select 'brief', brief_id, 'unclear' from test.numbat;
select test.check((select count(*) from public.problem_reports) = 2, 'a student reports a problem on their own answer and brief');
select test.refused($$insert into public.problem_reports (target_kind, target_id, category) select 'answer', answer_id, 'rude' from test.numbat$$,
  'only the five categories are allowed');
update public.problem_reports set status = 'resolved';
select test.check((select count(*) from public.problem_reports where status = 'open') = 2, 'a student cannot resolve their own report');
reset role;
create table test.numbat_reports as select id from public.problem_reports;
grant select on test.numbat_reports to authenticated;

select test.as_user('cccccccc-0000-0000-0000-000000000282');
select test.check((select count(*) from public.problem_reports) = 0, 'another student cannot see someone else''s reports');
select test.refused($$insert into public.problem_reports (target_kind, target_id, category) select 'answer', answer_id, 'outdated' from test.numbat$$,
  'a student cannot report someone else''s answer');
select test.check((select count(*) from public.problem_report_context((select id from test.numbat_reports limit 1))) = 0,
  'a student cannot read what was reported');
reset role;

select test.as_user('dddddddd-0000-0000-0000-000000000283');
select test.check((select count(*) from public.problem_reports) = 2, 'reviewers see every report');
select test.check((select body from public.problem_report_context((select id from public.problem_reports where target_kind = 'answer')))
  = 'A numbat writ lasts a year.', 'reviewers see what was reported');
update public.problem_reports set status = 'resolved' where target_kind = 'answer';
select test.check((select resolved_by from public.problem_reports where target_kind = 'answer') = 'dddddddd-0000-0000-0000-000000000283',
  'resolving records who did it');
select test.refused($$update public.problem_reports set note = 'Changed'$$, 'reviewers cannot change what the student wrote');
reset role;

-- Takedown requests ---------------------------------------------------------------------------------
select test.as_anon();
select public.submit_takedown('Ada Quokka', 'Ada@Example.test', 'Page 4 of the numbat notes', 'It is my own copyrighted work.');
select test.refused($$select * from public.takedown_requests$$, 'visitors cannot read takedown requests');
reset role;
select test.as_anon();
do $$
begin
  perform public.submit_takedown('Ada', 'not-an-email', 'x', 'y');
  raise exception 'FAILED: a request without a real email was accepted';
exception when check_violation then
  raise notice 'ok - a takedown request needs a real email address (refused)';
end $$;
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000282');
select test.check((select count(*) from public.takedown_requests) = 0, 'students cannot read takedown requests');
reset role;
select test.as_user('dddddddd-0000-0000-0000-000000000283');
select test.check((select email from public.takedown_requests) = 'ada@example.test', 'reviewers read takedown requests');
update public.takedown_requests set status = 'done';
select test.check((select done_at is not null from public.takedown_requests), 'closing a request records when');
reset role;

-- Deleting an account ---------------------------------------------------------------------------------
insert into storage.objects (bucket_id, name, owner)
  values ('uploads', 'cccccccc-0000-0000-0000-000000000281/aaaaaaaa-0000-0000-0000-000000000001.pdf', 'cccccccc-0000-0000-0000-000000000281');
select test.as_user('cccccccc-0000-0000-0000-000000000281');
do $$
begin
  perform public.delete_my_account('delete');
  raise exception 'FAILED: an account was deleted without typing DELETE';
exception when invalid_parameter_value then
  raise notice 'ok - deleting an account needs DELETE typed (refused)';
end $$;
do $$
begin
  perform public.delete_my_account('DELETE');
  raise exception 'FAILED: an account was deleted while files were still stored';
exception when object_not_in_prerequisite_state then
  raise notice 'ok - an account is not deleted while its files are still stored (refused)';
end $$;
reset role;
delete from storage.objects where name like 'cccccccc-0000-0000-0000-000000000281/%';
select test.as_user('cccccccc-0000-0000-0000-000000000281');
select public.delete_my_account('DELETE');
reset role;
select test.check((select count(*) from auth.users where id = 'cccccccc-0000-0000-0000-000000000281') = 0, 'a student deletes their account');
select test.check(
  (select count(*) from public.profiles where id = 'cccccccc-0000-0000-0000-000000000281')
  + (select count(*) from public.projects where owner_id = 'cccccccc-0000-0000-0000-000000000281')
  + (select count(*) from public.conversations where owner_id = 'cccccccc-0000-0000-0000-000000000281')
  + (select count(*) from public.messages where owner_id = 'cccccccc-0000-0000-0000-000000000281')
  + (select count(*) from public.briefs where owner_id = 'cccccccc-0000-0000-0000-000000000281')
  + (select count(*) from public.problem_reports where owner_id = 'cccccccc-0000-0000-0000-000000000281') = 0,
  'all of the student''s data goes with the account');
select test.check((select count(*) from public.projects where name = 'Bilby file') = 1, 'nobody else''s data is touched');

select test.as_user('dddddddd-0000-0000-0000-000000000283');
do $$
begin
  perform public.delete_my_account('DELETE');
  raise exception 'FAILED: a reviewer deleted their own account';
exception when insufficient_privilege then
  raise notice 'ok - reviewer accounts are removed by the founder only (refused)';
end $$;
reset role;
select test.as_anon();
select test.refused($$select public.delete_my_account('DELETE')$$, 'visitors cannot delete accounts');
reset role;
