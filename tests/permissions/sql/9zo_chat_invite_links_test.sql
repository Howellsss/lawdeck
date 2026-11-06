-- Permission tests at database level: study group invite links and the ID test switch (migration 66).
-- Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a5c66001-0000-0000-0000-000000000001', 'ada66@test.invalid', '{"full_name": "Ada Sixtysix"}'),
  ('a5c66002-0000-0000-0000-000000000002', 'bola66@test.invalid', '{"full_name": "Bola Sixtysix"}'),
  ('a5c66003-0000-0000-0000-000000000003', 'chi66@test.invalid', '{"full_name": "Chi Sixtysix"}'),
  ('a5c66004-0000-0000-0000-000000000004', 'dayo66@test.invalid', '{"full_name": "Dayo Sixtysix"}'),
  ('a5c66005-0000-0000-0000-000000000005', 'admin66@test.invalid', '{"full_name": "Admin Sixtysix"}');
update public.profiles set role = 'admin' where id = 'a5c66005-0000-0000-0000-000000000005';
update public.chat_settings set open_to_students = true;
-- Invite-only for these tests, so the link's Lawdeck access can be checked.
update public.pilot_settings set invite_only = true;
update public.profiles set pilot_access_at = now() where id in ('a5c66001-0000-0000-0000-000000000001', 'a5c66002-0000-0000-0000-000000000002', 'a5c66004-0000-0000-0000-000000000004');

-- Ada is a verified Lagos student and chat member; Dayo a verified aspirant.
insert into public.chat_verifications (owner_id, kind, campus_key, id_number) values
  ('a5c66001-0000-0000-0000-000000000001', 'student', 'lagos', 'NLS/66/1'),
  ('a5c66004-0000-0000-0000-000000000004', 'aspirant', 'aspirant', 'UNI/66/4');
update public.chat_verifications set status = 'approved' where id_number in ('NLS/66/1', 'UNI/66/4');
insert into public.chat_members (owner_id) values ('a5c66001-0000-0000-0000-000000000001'), ('a5c66004-0000-0000-0000-000000000004');

select test.as_user('a5c66001-0000-0000-0000-000000000001');
select public.chat_create_study_group('Link squad') as squad \gset
reset role;
create temporary table g66 as select id, key from public.chat_groups where key = :'squad';
grant select on g66 to authenticated;

-- Making links ----------------------------------------------------------------------------------
select test.as_user('a5c66001-0000-0000-0000-000000000001');
select public.chat_link_create((select id from g66)) as code \gset
select test.check(char_length(:'code') = 64 and public.chat_link_status((select id from g66)) > now() + interval '6 days', 'the creator makes a 7-day link');
select test.refused($$select * from public.chat_group_links$$, 'nobody reads the links table directly');
reset role;
select test.check(not exists (select 1 from public.chat_group_links where code_hash = :'code'), 'only a hash of the code is stored');

select test.as_user('a5c66004-0000-0000-0000-000000000004');
select test.refused($$select public.chat_link_create((select id from g66))$$, 'only the creator makes links');
select test.check(public.chat_link_status((select id from g66)) is null, 'or sees whether one is working');
reset role;

-- Opening a link, step by step -------------------------------------------------------------------
select test.as_user('a5c66003-0000-0000-0000-000000000003');
select test.check((select result = 'invalid' from public.chat_link_open('not-a-real-code-at-all-123')), 'a made-up code finds nothing');
select test.check((select result = 'access' and group_name = 'Link squad' and group_key is null from public.chat_link_open(:'code')),
  'a new person sees the group''s name and that the link lets them into Lawdeck');
select test.check(public.chat_link_claim_access(:'code'), 'the link lets them into Lawdeck');
select test.check(not public.chat_link_claim_access('not-a-real-code-at-all-123'), 'a made-up code does not');
select test.check((select result = 'verify' from public.chat_link_open(:'code')), 'next, the chat ID step');
reset role;

-- The ID test switch: off, a request waits for an admin; on, it is approved at once.
select test.as_user('a5c66003-0000-0000-0000-000000000003');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'lagos', '123');
select test.check((select status = 'pending' from public.chat_verifications where owner_id = 'a5c66003-0000-0000-0000-000000000003'), 'with the switch off, an ID waits for an admin');
reset role;
delete from public.chat_verifications where owner_id = 'a5c66003-0000-0000-0000-000000000003';
select test.as_user('a5c66003-0000-0000-0000-000000000003');
update public.chat_settings set auto_approve_ids = true where id;
reset role;
select test.check(not (select auto_approve_ids from public.chat_settings where id), 'students cannot turn the switch on');
select test.as_user('a5c66005-0000-0000-0000-000000000005');
update public.chat_settings set auto_approve_ids = true where id;
reset role;
select test.check((select auto_approve_ids from public.chat_settings where id), 'admins turn the switch on');
select test.as_user('a5c66003-0000-0000-0000-000000000003');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'lagos', '123');
select test.check((select status = 'approved' and decided_by is null and note like 'Approved automatically%'
                     from public.chat_verifications where owner_id = 'a5c66003-0000-0000-0000-000000000003'), 'with it on, any number is approved at once, marked as automatic');
select test.check((select result = 'rules' from public.chat_link_open(:'code')), 'next, the community rules');
select test.refused(format('select public.chat_link_join(%L)', :'code'), 'nobody joins before accepting the rules');
insert into public.chat_members (owner_id) values ('a5c66003-0000-0000-0000-000000000003');
select test.check((select result = 'ready' from public.chat_link_open(:'code')), 'then they can join');
select test.check(public.chat_link_join(:'code') = :'squad', 'they join through the link');
select test.check((select result = 'member' and group_key = :'squad' from public.chat_link_open(:'code')), 'and the link now takes them to the group');
reset role;
update public.chat_settings set auto_approve_ids = false where id;

-- Rules that stay --------------------------------------------------------------------------------
select test.as_user('a5c66004-0000-0000-0000-000000000004');
select test.check((select result = 'other_side' from public.chat_link_open(:'code')), 'aspirants cannot join a student group by link');
select test.refused(format('select public.chat_link_join(%L)', :'code'), 'even by calling join directly');
reset role;

-- Turning off and replacing
select test.as_user('a5c66001-0000-0000-0000-000000000001');
select public.chat_link_create((select id from g66)) as code2 \gset
select test.check((select result = 'invalid' from public.chat_link_open(:'code')), 'a new link stops the old one');
select public.chat_link_revoke((select id from g66));
select test.check((select result = 'invalid' from public.chat_link_open(:'code2')), 'turning it off stops it');
select public.chat_link_create((select id from g66)) as code3 \gset
reset role;
update public.chat_group_links set expires_at = now() - interval '1 minute' where revoked_at is null;
select test.as_user('a5c66003-0000-0000-0000-000000000003');
select test.check((select result = 'invalid' from public.chat_link_open(:'code3')), 'links expire after 7 days');
select test.refused(format('select public.chat_link_join(%L)', :'code3'), 'and cannot be used to join');
reset role;

-- Full at 15 members.
select test.as_user('a5c66001-0000-0000-0000-000000000001');
select public.chat_link_create((select id from g66)) as code4 \gset
reset role;
create temporary table fake66 as select gen_random_uuid() as id from generate_series(1, 13);
insert into auth.users (id, email) select id, id::text || '@test.invalid' from fake66;
insert into public.chat_group_members (group_id, owner_id, status) select (select id from g66), id, 'member' from fake66;
select test.as_user('a5c66002-0000-0000-0000-000000000002');
select test.check((select result = 'full' from public.chat_link_open(:'code4')), 'a full group says so');
reset role;
select test.as_anon();
select test.refused($$select * from public.chat_link_open('x')$$, 'signed-out visitors cannot use links');
reset role;
update public.pilot_settings set invite_only = false;
