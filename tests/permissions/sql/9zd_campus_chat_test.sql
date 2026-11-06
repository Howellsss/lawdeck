-- Permission tests at database level: campus chat, Phase 2 (migration 55). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a5c55001-0000-0000-0000-000000000001', 'studentA55@test.invalid', '{"full_name":"Ada Wombat"}'),
  ('a5c55002-0000-0000-0000-000000000002', 'studentB55@test.invalid', '{}'),
  ('a5c55003-0000-0000-0000-000000000003', 'reviewer55@test.invalid', '{"name":"Rex Quokka"}'),
  ('a5c55004-0000-0000-0000-000000000004', 'admin55@test.invalid', '{}');
update public.profiles set role = 'reviewer' where id = 'a5c55003-0000-0000-0000-000000000003';
update public.profiles set role = 'admin', full_name = 'Nora Numbat', campus = 'lagos' where id = 'a5c55004-0000-0000-0000-000000000004';
update public.pilot_settings set invite_only = false;

-- Phase 2: staff only -----------------------------------------------------------------------
select test.as_user('a5c55001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.chat_groups) = 0, 'students see no chat groups while chat is closed');
select test.refused($$insert into public.chat_members default values$$, 'and cannot join chat yet');
reset role;

select test.as_user('a5c55003-0000-0000-0000-000000000003');
select test.check((select count(*) from public.chat_groups) >= 9, 'staff see every group: all campuses, each campus, aspirants');
select test.check((select count(*) from public.chat_groups where key = 'all-campuses') = 1, 'including All campuses');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'Hello' from public.chat_groups where key = 'lagos'$$,
  'posting needs the community rules accepted first');
insert into public.chat_members default values;
insert into public.chat_messages (group_id, body, hashtags)
  select id, 'Who has the #civil notes for Order 3?', '{civil}' from public.chat_groups where key = 'lagos';
select test.check((select count(*) from public.chat_messages) = 1, 'a member posts in any campus group');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'This is bullshit' from public.chat_groups where key = 'lagos'$$,
  'a message with a curse word is not sent');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'You are a FUUUCKING clown' from public.chat_groups where key = 'abuja'$$,
  'whatever the capitals or repeated letters');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'sh1t happens' from public.chat_groups where key = 'abuja'$$,
  'or look-alike characters');
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'You be ashawo' from public.chat_groups where key = 'abuja'$$,
  'Pidgin and Yoruba ones too');
insert into public.chat_messages (group_id, body)
  select id, 'Reading Dickens on a cockroach-free Saturday; Ndi Igbo assess the class' from public.chat_groups where key = 'abuja';
select test.check((select count(*) from public.chat_messages) = 2, 'ordinary words that only contain a blocked word still send');
select test.refused($$insert into public.chat_messages (group_id, body, hashtags) select id, 'Hi', '{"bad tag"}' from public.chat_groups where key = 'abuja'$$,
  'a hashtag is one short word');
select test.refused($$insert into public.chat_messages (group_id, owner_id, body) select id, 'a5c55001-0000-0000-0000-000000000001', 'As Ada' from public.chat_groups where key = 'abuja'$$,
  'nobody can post in someone else''s name');
do $$
begin
  for i in 1..6 loop
    insert into public.chat_messages (group_id, body) select id, 'Quick message ' || i from public.chat_groups where key = 'kano';
  end loop;
end $$;
select test.refused($$insert into public.chat_messages (group_id, body) select id, 'One too many' from public.chat_groups where key = 'kano'$$,
  'the posting limit stops a flood of messages');
select test.check((select count(*) from public.chat_people(array['a5c55003-0000-0000-0000-000000000003'::uuid])) = 1, 'members are listed by name');
select test.check((select name from public.chat_people(array['a5c55003-0000-0000-0000-000000000003'::uuid])) = 'Rex Quokka', 'using the name given at sign-up');
select test.check((select count(*) from public.chat_people_search('Rex')) = 1, 'and can be found for an @mention');
reset role;

select test.as_user('a5c55004-0000-0000-0000-000000000004');
insert into public.chat_members default values;
select test.check((select unread from public.chat_unread_counts() u join public.chat_groups g on g.id = u.group_id where g.key = 'kano') = 0,
  'a new member starts with nothing unread');
reset role;

-- An admin opens chat to students -------------------------------------------------------------
select test.as_user('a5c55001-0000-0000-0000-000000000001');
update public.chat_settings set open_to_students = true;
reset role;
select test.check((select not open_to_students from public.chat_settings), 'students cannot open chat themselves');
select test.as_user('a5c55004-0000-0000-0000-000000000004');
update public.chat_settings set open_to_students = true;
reset role;

select test.as_user('a5c55001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.chat_groups) >= 9, 'once open, students see the groups');
select test.check((select count(*) from public.chat_messages) >= 2, 'and the messages');
insert into public.chat_members default values;
insert into public.chat_messages (group_id, body) select id, 'Hello from Ada' from public.chat_groups where key = 'abuja';
select test.check((select count(*) from public.chat_people_search('Ada')) = 1, 'a student is found by the name they signed up with');
select test.check((select unread from public.chat_unread_counts() u join public.chat_groups g on g.id = u.group_id where g.key = 'abuja') = 0,
  'their own messages are not unread for them');
delete from public.chat_messages where body = 'Who has the #civil notes for Order 3?';
select test.check((select count(*) from public.chat_messages where body like 'Who has%') = 1, 'a student cannot delete someone else''s message');
delete from public.chat_messages where body = 'Hello from Ada';
select test.check((select count(*) from public.chat_messages where body = 'Hello from Ada') = 0, 'but can delete their own');
select test.check((select count(*) from public.chat_blocked_words) = 0, 'students cannot read the blocked word list');
select test.refused($$insert into public.chat_blocked_words values ('hello')$$, 'or change it');
reset role;

select test.as_user('a5c55002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.chat_people_search('Ada')) = 1, 'other students can @mention a member');
select test.check((select count(*) from public.chat_people(array['a5c55002-0000-0000-0000-000000000002'::uuid])) = 0,
  'people who have not joined chat are never listed');
reset role;

select test.as_anon();
select test.refused($$select count(*) from public.chat_messages$$, 'visitors cannot read chat');
reset role;
update public.chat_settings set open_to_students = false;
