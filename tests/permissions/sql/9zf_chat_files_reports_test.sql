-- Permission tests at database level: chat files, reports and Hide (migration 57). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c57001-0000-0000-0000-000000000001', 'lagos57@test.invalid'),
  ('a5c57002-0000-0000-0000-000000000002', 'abuja57@test.invalid'),
  ('a5c57004-0000-0000-0000-000000000004', 'admin57@test.invalid');
update public.profiles set role = 'admin' where id = 'a5c57004-0000-0000-0000-000000000004';
update public.pilot_settings set invite_only = false;
update public.chat_settings set open_to_students = true;
create temporary table g57 as select key, id from public.chat_groups;
grant select on g57 to authenticated;

select test.as_user('a5c57001-0000-0000-0000-000000000001');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'lagos', 'NLS/57/1');
reset role;
select test.as_user('a5c57002-0000-0000-0000-000000000002');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'abuja', 'NLS/57/2');
reset role;
select test.as_user('a5c57004-0000-0000-0000-000000000004');
update public.chat_verifications set status = 'approved' where id_number in ('NLS/57/1', 'NLS/57/2');
reset role;

-- Files -----------------------------------------------------------------------------------------
select test.as_user('a5c57001-0000-0000-0000-000000000001');
insert into public.chat_members default values;
insert into storage.objects (bucket_id, name)
  select 'chat-files', id || '/a5c57001-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000005701.pdf' from g57 where key = 'lagos';
select test.check((select count(*) from storage.objects where bucket_id = 'chat-files') = 1, 'a member adds a file to their own folder in their group');
select test.refused($$insert into storage.objects (bucket_id, name) select 'chat-files', id || '/a5c57001-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000005702.pdf' from g57 where key = 'abuja'$$,
  'but not in another campus''s group');
select test.refused($$insert into storage.objects (bucket_id, name) select 'chat-files', id || '/a5c57002-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000005703.pdf' from g57 where key = 'lagos'$$,
  'or in someone else''s folder');
insert into public.chat_messages (group_id, body, attachments)
  select id, '', jsonb_build_array(jsonb_build_object('path', id || '/a5c57001-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000005701.pdf', 'name', 'Civil notes.pdf', 'kind', 'pdf', 'size', 1200))
    from g57 where key = 'lagos';
select test.check((select count(*) from public.chat_messages where attachments <> '[]') = 1, 'a message can be just a file');
select test.refused($$insert into public.chat_messages (group_id, body) select id, '   ' from g57 where key = 'lagos'$$, 'an empty message is not sent');
select test.refused($$insert into public.chat_messages (group_id, body, attachments) select id, 'x', jsonb_build_array(jsonb_build_object('path', 'elsewhere/x.pdf', 'name', 'x.pdf', 'kind', 'pdf', 'size', 1)) from g57 where key = 'lagos'$$,
  'a message can only point to the sender''s own files in that group');
select test.refused($$insert into public.chat_messages (group_id, body, attachments) select id, 'notes', jsonb_build_array(jsonb_build_object('path', id || '/a5c57001-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000005704.pdf', 'name', 'call 08031234567.pdf', 'kind', 'pdf', 'size', 10)) from g57 where key = 'lagos'$$,
  'file names are checked for contact details too');
insert into public.chat_messages (group_id, body) select id, 'Hello all campuses' from g57 where key = 'all-campuses';
reset role;

insert into storage.objects (bucket_id, name)
  select 'chat-files', id || '/a5c57004-0000-0000-0000-000000000004/00000000-0000-4000-8000-000000005705.png' from g57 where key = 'lagos';
select test.as_user('a5c57002-0000-0000-0000-000000000002');
select test.check((select count(*) from storage.objects where bucket_id = 'chat-files') = 0, 'an Abuja student cannot open files in the Lagos group');
insert into public.chat_members default values;
reset role;

-- Reports ----------------------------------------------------------------------------------------
create temporary table m57 as select id, body from public.chat_messages;
grant select on m57 to authenticated;
select test.as_user('a5c57002-0000-0000-0000-000000000002');
insert into public.chat_reports (message_id, reason, note) select id, 'abuse', 'Rude' from public.chat_messages where body = 'Hello all campuses';
select test.check((select count(*) from public.chat_reports) = 1, 'a student reports a message they can see');
do $$
begin
  insert into public.chat_reports (message_id, reason) select id, 'spam' from public.chat_messages where body = 'Hello all campuses';
  raise exception 'FAILED: a second report of the same message by the same person was allowed';
exception when unique_violation then
  raise notice 'ok - once per message (refused)';
end $$;
select test.refused($$insert into public.chat_reports (message_id, reason) select id, 'abuse' from m57 where body = ''$$,
  'but not one in another campus''s group');
select test.check((select public.chat_set_hidden(id, true) from public.chat_messages where body = 'Hello all campuses') = 'not_allowed', 'students cannot hide messages');
reset role;
select test.as_user('a5c57001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.chat_reports) = 0, 'the author does not see who reported them');
select test.check((select count(*) from public.chat_report_queue()) = 0, 'students cannot see the reports list');
reset role;

-- Admin hides ----------------------------------------------------------------------------------
select test.as_user('a5c57004-0000-0000-0000-000000000004');
select test.check((select reports = 1 and open_reports = 1 and author_email = 'lagos57@test.invalid' from public.chat_report_queue() where body = 'Hello all campuses'),
  'admins see reported messages with their author');
select test.check((select public.chat_set_hidden(id, true) from public.chat_messages where body = 'Hello all campuses') = 'ok', 'an admin hides a message');
select test.check((select open_reports = 0 from public.chat_report_queue() where body = 'Hello all campuses'), 'hiding closes its reports');
reset role;
select test.as_user('a5c57002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.chat_messages where body = 'Hello all campuses') = 0, 'a hidden message disappears for students');
reset role;
select test.as_user('a5c57004-0000-0000-0000-000000000004');
select test.check((select public.chat_set_hidden(id, false) from public.chat_messages where body = 'Hello all campuses') = 'ok', 'and can be shown again');
update public.chat_settings set open_to_students = false;
select test.check((select not open_to_students from public.chat_settings), 'admins open and close chat for students');
reset role;
