-- Permission tests at database level: chat verification, groups per campus, contact details
-- (migration 56). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c56001-0000-0000-0000-000000000001', 'lagos56@test.invalid'),
  ('a5c56002-0000-0000-0000-000000000002', 'abuja56@test.invalid'),
  ('a5c56003-0000-0000-0000-000000000003', 'aspirant56@test.invalid'),
  ('a5c56004-0000-0000-0000-000000000004', 'admin56@test.invalid'),
  ('a5c56005-0000-0000-0000-000000000005', 'stranger56@test.invalid');
update public.profiles set role = 'admin' where id = 'a5c56004-0000-0000-0000-000000000004';
update public.pilot_settings set invite_only = false;
update public.chat_settings set open_to_students = true;
create temporary table groups_56 as select key, id from public.chat_groups;
grant select on groups_56 to authenticated;

-- A free account alone gets nothing ----------------------------------------------------------
select test.as_user('a5c56005-0000-0000-0000-000000000005');
update public.profiles set campus = 'lagos' where id = 'a5c56005-0000-0000-0000-000000000005';
select test.check((select count(*) from public.chat_groups) = 0, 'choosing a campus is not enough: an unverified account sees no groups');
select test.check((select count(*) from public.chat_messages) = 0, 'or messages');
select test.refused($$insert into public.chat_members default values$$, 'and cannot join chat');
reset role;

-- Asking to be verified ------------------------------------------------------------------------
select test.as_user('a5c56001-0000-0000-0000-000000000001');
insert into public.chat_verifications (kind, campus_key, id_number, document_path)
  values ('student', 'lagos', 'NLS/LAG/24/001', 'a5c56001-0000-0000-0000-000000000001/id.png');
select test.check((select status = 'pending' from public.chat_verifications), 'a request starts as pending');
update public.chat_verifications set status = 'approved';
reset role;
select test.check((select status = 'pending' from public.chat_verifications where owner_id = 'a5c56001-0000-0000-0000-000000000001'),
  'a student cannot approve themselves');
select test.as_user('a5c56001-0000-0000-0000-000000000001');
do $$
begin
  insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'abuja', 'X-2');
  raise exception 'FAILED: a second open request was allowed';
exception when unique_violation then
  raise notice 'ok - only one open request at a time (refused)';
end $$;
select test.refused($$insert into public.chat_verifications (kind, campus_key, id_number) values ('aspirant', 'lagos', 'X-3')$$,
  'an aspirant request is for the Aspirants group only');
select test.check((select count(*) from public.chat_groups) = 0, 'nothing is visible while pending');
reset role;

select test.as_user('a5c56002-0000-0000-0000-000000000002');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'abuja', 'NLS/ABJ/24/002');
select test.check((select count(*) from public.chat_verifications) = 1, 'people see only their own request');
reset role;
select test.as_user('a5c56003-0000-0000-0000-000000000003');
insert into public.chat_verifications (kind, campus_key, id_number) values ('aspirant', 'aspirant', 'UNILAG/LAW/5');
reset role;

select test.as_user('a5c56001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.chat_verification_queue()) = 0, 'students cannot see the admins'' list of requests');
reset role;

-- An admin decides --------------------------------------------------------------------------
select test.as_user('a5c56004-0000-0000-0000-000000000004');
select test.check((select count(*) from public.chat_verification_queue() where email = 'lagos56@test.invalid' and status = 'pending') = 1,
  'admins see each request with the person''s email');
select test.check((select count(*) from public.chat_verifications where id_number in ('NLS/LAG/24/001', 'NLS/ABJ/24/002', 'UNILAG/LAW/5')) = 3, 'admins see every request');
update public.chat_verifications set status = 'approved' where id_number in ('NLS/LAG/24/001', 'NLS/ABJ/24/002', 'UNILAG/LAW/5');
select test.check((select count(*) from public.chat_verifications where decided_by = 'a5c56004-0000-0000-0000-000000000004') = 3,
  'each decision records who made it');
reset role;
select test.check((select campus = 'abuja' from public.profiles where id = 'a5c56002-0000-0000-0000-000000000002'),
  'approval sets the student''s campus to the verified one');

-- Groups per campus -------------------------------------------------------------------------
select test.as_user('a5c56001-0000-0000-0000-000000000001');
select test.check((select array_agg(key order by key) from public.chat_groups) = array['all-campuses', 'lagos'],
  'a Lagos student sees Lagos and All campuses only');
insert into public.chat_members default values;
insert into public.chat_messages (group_id, body) select id, 'Hello Lagos' from public.chat_groups where key = 'lagos';
insert into public.chat_messages (group_id, body) select id, 'Hello everyone' from public.chat_groups where key = 'all-campuses';
reset role;
select test.as_user('a5c56001-0000-0000-0000-000000000001');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'Sneaking in' from groups_56 where key = 'abuja'$$,
  'and cannot post in another campus group');
reset role;

select test.as_user('a5c56002-0000-0000-0000-000000000002');
select test.check((select array_agg(key order by key) from public.chat_groups) = array['abuja', 'all-campuses'],
  'an Abuja student sees Abuja and All campuses only');
select test.check((select count(*) from public.chat_messages where body = 'Hello Lagos') = 0, 'and cannot read the Lagos group');
select test.check((select count(*) from public.chat_messages where body = 'Hello everyone') = 1, 'but reads All campuses');
reset role;

select test.as_user('a5c56003-0000-0000-0000-000000000003');
select test.check((select array_agg(key order by key) from public.chat_groups) = array['aspirant'], 'an aspirant sees only Aspirants');
select test.check((select count(*) from public.chat_messages) = 0, 'and no student messages');
reset role;

-- No contact details ---------------------------------------------------------------------------
select test.as_user('a5c56001-0000-0000-0000-000000000001');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'Call me on 0803 123 4567' from public.chat_groups where key = 'lagos'$$,
  'a phone number is not sent');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'whatsapp +234-803-123-4567' from public.chat_groups where key = 'lagos'$$,
  'in any format');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'mail ada.wombat@example.com' from public.chat_groups where key = 'lagos'$$,
  'nor an email address');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'join https://chat.whatsapp.com/abc' from public.chat_groups where key = 'lagos'$$,
  'nor a WhatsApp or social link');
insert into public.chat_messages (group_id, body)
  select id, 'See (2001) 1 NWLR (Pt 700) 123, s. 25(1) and Order 3 rule 5 of the 2019 Rules' from public.chat_groups where key = 'lagos';
select test.check((select count(*) from public.chat_messages where body like 'See (2001)%') = 1, 'case citations and section numbers still send');
reset role;

-- Removal from chat ----------------------------------------------------------------------------
select test.as_user('a5c56004-0000-0000-0000-000000000004');
update public.chat_verifications set status = 'revoked' where id_number = 'NLS/ABJ/24/002';
reset role;
select test.as_user('a5c56002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.chat_groups) = 0, 'a removed student loses chat at once');
select test.refused($$insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'abuja', 'AGAIN')$$,
  'and cannot ask again');
reset role;

-- ID documents --------------------------------------------------------------------------------
insert into storage.objects (bucket_id, name, owner) values ('chat-ids', 'a5c56001-0000-0000-0000-000000000001/id.png', 'a5c56001-0000-0000-0000-000000000001');
select test.as_user('a5c56002-0000-0000-0000-000000000002');
select test.check((select count(*) from storage.objects where bucket_id = 'chat-ids') = 0, 'nobody else can see a student''s ID document');
select test.refused($$insert into storage.objects (bucket_id, name) values ('chat-ids', 'a5c56001-0000-0000-0000-000000000001/fake.png')$$,
  'or put a file in their folder');
reset role;
select test.as_user('a5c56004-0000-0000-0000-000000000004');
select test.check((select count(*) from storage.objects where bucket_id = 'chat-ids') = 1, 'admins can open it to check');
reset role;
update public.chat_settings set open_to_students = false;
