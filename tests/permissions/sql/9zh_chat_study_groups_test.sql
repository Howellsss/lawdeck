-- Permission tests at database level: study groups (migration 59). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a5c59001-0000-0000-0000-000000000001', 'ada59@test.invalid', '{"full_name": "Ada Fiftynine"}'),
  ('a5c59002-0000-0000-0000-000000000002', 'bola59@test.invalid', '{"full_name": "Bola Fiftynine"}'),
  ('a5c59003-0000-0000-0000-000000000003', 'chi59@test.invalid', '{"full_name": "Chi Fiftynine"}'),
  ('a5c59004-0000-0000-0000-000000000004', 'dayo59@test.invalid', '{"full_name": "Dayo Aspirant"}'),
  ('a5c59005-0000-0000-0000-000000000005', 'admin59@test.invalid', '{"full_name": "Admin Fiftynine"}'),
  ('a5c59006-0000-0000-0000-000000000006', 'free59@test.invalid', '{"full_name": "Free Fiftynine"}');
update public.profiles set role = 'admin' where id = 'a5c59005-0000-0000-0000-000000000005';
update public.pilot_settings set invite_only = false;
update public.chat_settings set open_to_students = true;

-- Ada (Lagos), Bola (Abuja), Chi (Lagos) are verified students; Dayo is a verified aspirant.
select test.as_user('a5c59001-0000-0000-0000-000000000001');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'lagos', 'NLS/59/1');
reset role;
select test.as_user('a5c59002-0000-0000-0000-000000000002');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'abuja', 'NLS/59/2');
reset role;
select test.as_user('a5c59003-0000-0000-0000-000000000003');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'lagos', 'NLS/59/3');
reset role;
select test.as_user('a5c59004-0000-0000-0000-000000000004');
insert into public.chat_verifications (kind, campus_key, id_number) values ('aspirant', 'aspirant', 'UNI/59/4');
reset role;
select test.as_user('a5c59005-0000-0000-0000-000000000005');
update public.chat_verifications set status = 'approved' where id_number in ('NLS/59/1', 'NLS/59/2', 'NLS/59/3', 'UNI/59/4');
reset role;
select test.as_user('a5c59002-0000-0000-0000-000000000002');
insert into public.chat_members default values;
reset role;
select test.as_user('a5c59003-0000-0000-0000-000000000003');
insert into public.chat_members default values;
reset role;
select test.as_user('a5c59004-0000-0000-0000-000000000004');
insert into public.chat_members default values;
reset role;

-- Creating ---------------------------------------------------------------------------------------
select test.as_user('a5c59001-0000-0000-0000-000000000001');
select test.check(public.chat_create_study_group('Civil Lit squad') = 'not_allowed', 'only people who accepted the rules create groups');
insert into public.chat_members default values;
select public.chat_create_study_group('Civil Lit squad') as squad \gset
select test.check(:'squad' ~ '^s-[a-z]{10}$', 'a member creates a study group and gets its key');
select test.check(public.chat_create_study_group('x') = 'bad_name', 'a name needs at least 2 characters');
select test.check(public.chat_create_study_group('Call 08031234567') = 'bad_name', 'a name cannot hold contact details');
select test.check((select count(*) from public.chat_groups where key = :'squad') = 1, 'the creator sees their group');
select test.check((select count(*) from public.chat_group_members where group_id = (select id from public.chat_groups where key = :'squad')) = 1,
  'and is its first member');
reset role;
create temporary table k59 as select id, key from public.chat_groups where key = :'squad';
grant select on k59 to authenticated;

select test.as_user('a5c59002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.chat_groups where kind = 'study') = 0, 'others do not see a study group they are not in');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'Let me in' from k59$$, 'or post in it');
select test.check(public.chat_invite((select id from k59), 'a5c59002-0000-0000-0000-000000000002') = 'not_allowed', 'or invite themselves');
reset role;
select test.as_user('a5c59005-0000-0000-0000-000000000005');
select test.check((select count(*) from public.chat_groups where kind = 'study') = 0, 'staff do not see private study groups either');
reset role;

-- Inviting ---------------------------------------------------------------------------------------
select test.as_user('a5c59001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.chat_invite_search((select id from k59), 'Bola')) = 1, 'a member finds students to invite by name');
select test.check((select count(*) from public.chat_invite_search((select id from k59), 'Dayo')) = 0, 'aspirants are not offered to a students'' group');
select test.check(public.chat_invite((select id from k59), 'a5c59004-0000-0000-0000-000000000004') = 'not_allowed', 'and cannot be invited to it');
select test.check(public.chat_invite((select id from k59), 'a5c59006-0000-0000-0000-000000000006') = 'not_allowed', 'nor can people outside chat');
select test.check(public.chat_invite((select id from k59), 'a5c59002-0000-0000-0000-000000000002') = 'ok', 'a member invites a student from another campus');
select test.check(public.chat_invite((select id from k59), 'a5c59002-0000-0000-0000-000000000002') = 'already', 'only once');
select test.check(public.chat_invite((select id from k59), 'a5c59003-0000-0000-0000-000000000003') = 'ok', 'and invites a second student');
select test.refused($$insert into public.chat_group_members (group_id, owner_id, status) select id, 'a5c59002-0000-0000-0000-000000000002', 'member' from k59$$,
  'nobody adds members directly');
reset role;

select test.as_user('a5c59002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.chat_my_invites() where group_name = 'Civil Lit squad' and invited_by = 'Ada Fiftynine') = 1,
  'the invited student sees the invitation and who sent it');
select test.check((select count(*) from public.chat_groups where kind = 'study') = 0, 'but not the group until they accept');
select test.check(public.chat_answer_invite((select id from k59), true) = 'ok', 'they accept');
select test.check((select count(*) from public.chat_groups where kind = 'study') = 1, 'and now see the group');
insert into public.chat_messages (group_id, body) select id, 'Hello squad' from k59;
select test.check((select count(*) from public.chat_messages where body = 'Hello squad') = 1, 'and post in it');
select test.check((select count(*) from public.chat_group_people((select id from k59))) = 3, 'members see who is in the group and who is invited');
select test.check((select members from public.chat_member_counts() where group_id = (select id from k59)) = 2, 'the count shows accepted members only');
select test.check(public.chat_remove_member((select id from k59), 'a5c59003-0000-0000-0000-000000000003') = 'not_allowed', 'only the creator removes people');
select test.check(public.chat_rename_group((select id from k59), 'Mine now') = 'not_allowed', 'or renames the group');
select test.check(public.chat_delete_group((select id from k59)) = 'not_allowed', 'or deletes it');
reset role;

select test.as_user('a5c59003-0000-0000-0000-000000000003');
select test.check(public.chat_answer_invite((select id from k59), false) = 'ok', 'an invitation can be declined');
select test.check((select count(*) from public.chat_my_invites()) = 0, 'and disappears');
reset role;

select test.as_user('a5c59001-0000-0000-0000-000000000001');
select test.check(public.chat_rename_group((select id from k59), 'Civil Lit crew') = 'ok', 'the creator renames the group');
select test.check(public.chat_rename_group((select id from k59), 'bullshit crew') = 'bad_name', 'a new name goes through the word filter too');
select test.check(public.chat_leave_group((select id from k59)) = 'owner', 'the creator cannot leave, only delete');
select test.check(public.chat_remove_member((select id from k59), 'a5c59002-0000-0000-0000-000000000002') = 'ok', 'the creator removes a member');
reset role;
select test.as_user('a5c59002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.chat_groups where kind = 'study') = 0, 'a removed member no longer sees the group');
select test.check((select count(*) from public.chat_messages where body = 'Hello squad') = 0, 'or its messages');
reset role;

-- Aspirants have their own study groups ---------------------------------------------------------
select test.as_user('a5c59004-0000-0000-0000-000000000004');
select public.chat_create_study_group('Aspirants prep') as prep \gset
select test.check((select audience from public.chat_groups where key = :'prep') = 'aspirant', 'an aspirant''s group is for aspirants');
select test.check(public.chat_invite((select id from public.chat_groups where key = :'prep'), 'a5c59001-0000-0000-0000-000000000001') = 'not_allowed',
  'and students cannot be invited to it');
reset role;

-- Limits and leaving ------------------------------------------------------------------------------
select test.as_user('a5c59001-0000-0000-0000-000000000001');
select public.chat_invite((select id from k59), 'a5c59002-0000-0000-0000-000000000002');
reset role;
select test.as_user('a5c59002-0000-0000-0000-000000000002');
select public.chat_answer_invite((select id from k59), true);
select test.check(public.chat_leave_group((select id from k59)) = 'ok', 'a member leaves');
select test.check((select count(*) from public.chat_groups where kind = 'study') = 0, 'and no longer sees the group');
reset role;
select test.as_user('a5c59001-0000-0000-0000-000000000001');
select public.chat_create_study_group('Group ' || n) from generate_series(2, 10) n;
select test.check(public.chat_create_study_group('Eleventh group') = 'too_many', 'at most 10 groups each');
select test.check(public.chat_delete_group((select id from k59)) = 'ok', 'the creator deletes a group');
select test.check((select count(*) from public.chat_groups where key = :'squad') = 0, 'and it is gone');
reset role;

-- Visitors ---------------------------------------------------------------------------------------
set role anon;
select test.refused($$select public.chat_create_study_group('Visitors')$$, 'visitors cannot create groups');
reset role;

update public.chat_settings set open_to_students = false;
