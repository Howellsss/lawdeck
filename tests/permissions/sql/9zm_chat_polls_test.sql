-- Permission tests at database level: polls in chat (migration 64). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a5c64001-0000-0000-0000-000000000001', 'ada64@test.invalid', '{"full_name": "Ada Sixtyfour"}'),
  ('a5c64002-0000-0000-0000-000000000002', 'bola64@test.invalid', '{"full_name": "Bola Sixtyfour"}'),
  ('a5c64003-0000-0000-0000-000000000003', 'chi64@test.invalid', '{"full_name": "Chi Sixtyfour"}'),
  ('a5c64004-0000-0000-0000-000000000004', 'dayo64@test.invalid', '{"full_name": "Dayo Sixtyfour"}');
update public.pilot_settings set invite_only = false;
update public.chat_settings set open_to_students = true;

-- Ada, Bola and Chi are verified Lagos students and chat members; Dayo is verified in Abuja.
do $$
declare p uuid;
begin
  foreach p in array array['a5c64001-0000-0000-0000-000000000001', 'a5c64002-0000-0000-0000-000000000002',
                           'a5c64003-0000-0000-0000-000000000003']::uuid[] loop
    insert into public.chat_verifications (owner_id, kind, campus_key, id_number, status) values (p, 'student', 'lagos', 'NLS/64/' || right(p::text, 1), 'pending');
    insert into public.chat_members (owner_id) values (p);
  end loop;
  insert into public.chat_verifications (owner_id, kind, campus_key, id_number, status) values ('a5c64004-0000-0000-0000-000000000004', 'student', 'abuja', 'NLS/64/4', 'pending');
  insert into public.chat_members (owner_id) values ('a5c64004-0000-0000-0000-000000000004');
  update public.chat_verifications set status = 'approved' where id_number like 'NLS/64/%';
end $$;

select test.as_user('a5c64001-0000-0000-0000-000000000001');
select public.chat_create_study_group('Poll squad') as squad \gset
select public.chat_invite((select id from public.chat_groups where key = :'squad'), 'a5c64002-0000-0000-0000-000000000002');
reset role;
create temporary table g64 as select id, key from public.chat_groups where key in (:'squad', 'lagos');
grant select on g64 to authenticated;
select test.as_user('a5c64002-0000-0000-0000-000000000002');
select public.chat_answer_invite((select id from g64 where key like 's-%'), true);
reset role;

-- Making polls -----------------------------------------------------------------------------------
select test.as_user('a5c64001-0000-0000-0000-000000000001');
select public.chat_poll_create((select id from g64 where key = 'lagos'), 'Revision class on which day?', array['Monday', 'Tuesday', 'Wednesday'], 3) as campus_poll \gset
select test.check((select poll and body = 'Revision class on which day?' from public.chat_messages where id = :'campus_poll'), 'a member makes a poll in a campus group');
select test.refused($$select public.chat_poll_create((select id from g64 where key = 'lagos'), 'Who?', array['A', 'B'], 1, true)$$, 'names can be shown in study groups only');
select test.refused($$select public.chat_poll_create((select id from g64 where key = 'lagos'), 'One choice?', array['Only'], 1)$$, 'a poll needs at least 2 choices');
select test.refused($$select public.chat_poll_create((select id from g64 where key = 'lagos'), 'Too many?', array['1', '2', '3', '4', '5', '6', '7'], 1)$$, 'and at most 6');
select test.refused($$select public.chat_poll_create((select id from g64 where key = 'lagos'), 'Same?', array['Yes', 'yes'], 1)$$, 'choices must differ');
select test.refused($$select public.chat_poll_create((select id from g64 where key = 'lagos'), 'How long?', array['A', 'B'], 2)$$, 'a poll lasts 1, 3 or 7 days');
select test.refused($$select public.chat_poll_create((select id from g64 where key = 'lagos'), 'Call me?', array['08012345678', 'No'], 1)$$, 'choices go through the contact-details check');
select test.refused($$select public.chat_poll_create((select id from g64 where key = 'lagos'), 'Email me at ada@test.invalid', array['Yes', 'No'], 1)$$, 'and so does the question');
select public.chat_poll_create((select id from g64 where key like 's-%'), 'Meet online or in person?', array['Online', 'In person'], 1, true) as squad_poll \gset
select test.refused($$select * from public.chat_polls$$, 'nobody reads the poll tables directly');
select test.refused($$select * from public.chat_poll_votes$$, 'or the votes');
select test.refused($$insert into public.chat_messages (group_id, body, poll) values ((select id from g64 where key = 'lagos'), 'Fake poll', true)$$, 'nobody marks a message as a poll by writing it directly');
reset role;

select test.as_user('a5c64003-0000-0000-0000-000000000003');
select test.refused($$select public.chat_poll_create((select id from g64 where key like 's-%'), 'Sneak?', array['A', 'B'], 1)$$, 'nobody makes a poll in a study group they are not in');
reset role;

-- Voting ----------------------------------------------------------------------------------------
create temporary table p64 as select message_id, id from public.chat_polls where message_id in (:'campus_poll', :'squad_poll');
grant select on p64 to authenticated;

select test.as_user('a5c64002-0000-0000-0000-000000000002');
select test.check((select counts is null and voters is null from public.chat_poll_cards(array[:'campus_poll']::uuid[])), 'results stay hidden until you vote');
select test.check(public.chat_poll_vote((select id from p64 where message_id = :'campus_poll'), 0) = 'ok', 'a member votes');
select test.check(public.chat_poll_vote((select id from p64 where message_id = :'campus_poll'), 1) = 'ok', 'and can change the vote');
select test.check(public.chat_poll_vote((select id from p64 where message_id = :'campus_poll'), 3) = 'not_allowed', 'only a real choice counts');
select test.check((select counts = array[0, 1, 0] and my_choice = 1 and voters is null from public.chat_poll_cards(array[:'campus_poll']::uuid[])),
  'one vote each, and anonymous polls show counts only');
select test.check(public.chat_poll_close((select id from p64 where message_id = :'campus_poll')) = 'not_allowed', 'only the maker closes a poll');
select test.check(public.chat_poll_vote((select id from p64 where message_id = :'squad_poll'), 0) = 'ok', 'a study group member votes');
select test.check((select voters -> 0 ->> 0 = 'a5c64002-0000-0000-0000-000000000002' from public.chat_poll_cards(array[:'squad_poll']::uuid[])),
  'and sees who voted when the maker chose to show names');
reset role;

select test.as_user('a5c64003-0000-0000-0000-000000000003');
select test.check(public.chat_poll_vote((select id from p64 where message_id = :'squad_poll'), 0) = 'not_allowed', 'outsiders cannot vote in a study group poll');
select test.check((select count(*) from public.chat_poll_cards(array[:'squad_poll']::uuid[])) = 0, 'or see it');
select test.check(public.chat_poll_vote((select id from p64 where message_id = :'campus_poll'), 0) = 'ok', 'a classmate votes in the campus poll');
reset role;

select test.as_user('a5c64004-0000-0000-0000-000000000004');
select test.check(public.chat_poll_vote((select id from p64 where message_id = :'campus_poll'), 0) = 'not_allowed', 'students on another campus cannot vote');
reset role;
select test.as_anon();
select test.refused($$select * from public.chat_poll_cards(array[gen_random_uuid()])$$, 'signed-out visitors see no polls');
reset role;

-- Closing ---------------------------------------------------------------------------------------
select test.as_user('a5c64001-0000-0000-0000-000000000001');
select test.check(public.chat_poll_close((select id from p64 where message_id = :'campus_poll')) = 'ok', 'the maker closes the poll early');
select test.check((select closed and counts = array[1, 1, 0] from public.chat_poll_cards(array[:'campus_poll']::uuid[])), 'once closed, everyone sees the results');
reset role;
select test.as_user('a5c64002-0000-0000-0000-000000000002');
select test.check(public.chat_poll_vote((select id from p64 where message_id = :'campus_poll'), 2) = 'closed', 'nobody votes after it closes');
reset role;
-- A poll past its closing time is closed too.
update public.chat_polls set closes_at = now() - interval '1 minute' where message_id = :'squad_poll';
select test.as_user('a5c64002-0000-0000-0000-000000000002');
select test.check(public.chat_poll_vote((select id from p64 where message_id = :'squad_poll'), 1) = 'closed', 'a poll closes by itself at its time');
reset role;

-- An admin hiding the message hides the poll; deleting the message deletes it.
update public.chat_messages set hidden_at = now() where id = :'campus_poll';
select test.as_user('a5c64003-0000-0000-0000-000000000003');
select test.check((select count(*) from public.chat_poll_cards(array[:'campus_poll']::uuid[])) = 0, 'a hidden poll is gone for students');
reset role;
select test.as_user('a5c64001-0000-0000-0000-000000000001');
delete from public.chat_messages where id = :'squad_poll';
reset role;
select test.check(not exists (select 1 from public.chat_polls where message_id = :'squad_poll'), 'deleting the message deletes its poll and votes');
