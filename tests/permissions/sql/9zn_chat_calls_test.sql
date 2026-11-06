-- Permission tests at database level: group calls in study groups (migration 65). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a5c65001-0000-0000-0000-000000000001', 'ada65@test.invalid', '{"full_name": "Ada Sixtyfive"}'),
  ('a5c65002-0000-0000-0000-000000000002', 'bola65@test.invalid', '{"full_name": "Bola Sixtyfive"}'),
  ('a5c65003-0000-0000-0000-000000000003', 'chi65@test.invalid', '{"full_name": "Chi Sixtyfive"}'),
  ('a5c65005-0000-0000-0000-000000000005', 'admin65@test.invalid', '{"full_name": "Admin Sixtyfive"}');
update public.profiles set role = 'admin' where id = 'a5c65005-0000-0000-0000-000000000005';
update public.pilot_settings set invite_only = false;
update public.chat_settings set open_to_students = true;

do $$
declare p uuid;
begin
  foreach p in array array['a5c65001-0000-0000-0000-000000000001', 'a5c65002-0000-0000-0000-000000000002', 'a5c65003-0000-0000-0000-000000000003']::uuid[] loop
    insert into public.chat_verifications (owner_id, kind, campus_key, id_number, status) values (p, 'student', 'lagos', 'NLS/65/' || right(p::text, 1), 'pending');
    insert into public.chat_members (owner_id) values (p);
  end loop;
  update public.chat_verifications set status = 'approved' where id_number like 'NLS/65/%';
end $$;

select test.as_user('a5c65001-0000-0000-0000-000000000001');
select public.chat_create_study_group('Call squad') as squad \gset
select public.chat_invite((select id from public.chat_groups where key = :'squad'), 'a5c65002-0000-0000-0000-000000000002');
reset role;
create temporary table g65 as select id, key from public.chat_groups where key in (:'squad', 'lagos');
grant select on g65 to authenticated;
select test.as_user('a5c65002-0000-0000-0000-000000000002');
select public.chat_answer_invite((select id from g65 where key like 's-%'), true);
reset role;

-- Starting and joining ---------------------------------------------------------------------------
select test.as_user('a5c65001-0000-0000-0000-000000000001');
select call_id as call, room, started from public.chat_call_join((select id from g65 where key like 's-%')) \gset
select test.check(:'started'::boolean and :'room' = 'lawdeck-' || :'call', 'a member starts a call in their study group');
select test.check((select count(*) from public.chat_messages m join g65 on g65.id = m.group_id where g65.key like 's-%' and m.body = '📞 Started a group call') = 1,
  'and the group is told');
select test.refused($$select * from public.chat_call_join((select id from g65 where key = 'lagos'))$$, 'calls are for study groups only');
select test.refused($$select * from public.chat_calls$$, 'nobody reads the call tables directly');
select test.refused($$select * from public.chat_call_presence$$, 'or who was in a call');
select test.check(public.chat_call_heartbeat(:'call') = 'ok', 'checking in keeps you in the call');
reset role;

select test.as_user('a5c65002-0000-0000-0000-000000000002');
select test.check((select call_id = :'call' and not started from public.chat_call_join((select id from g65 where key like 's-%'))), 'another member joins the same call');
select test.check((select cardinality(people) = 2 from public.chat_call_status((select id from g65 where key like 's-%'))), 'the group sees who is in the call');
reset role;

select test.as_user('a5c65003-0000-0000-0000-000000000003');
select test.refused($$select * from public.chat_call_join((select id from g65 where key like 's-%'))$$, 'outsiders cannot join');
select test.check((select count(*) from public.chat_call_status((select id from g65 where key like 's-%'))) = 0, 'or see the call');
select test.check(public.chat_call_heartbeat(:'call') = 'end', 'or stay in it by checking in');
select test.check((select count(*) from public.chat_call_usage()) = 0, 'only admins see call usage');
reset role;
select test.as_anon();
select test.refused($$select * from public.chat_call_status(gen_random_uuid())$$, 'signed-out visitors see no calls');
reset role;

-- At most 15 people in a call (14 others already in).
create temporary table fake65 as select gen_random_uuid() as id from generate_series(1, 15);
insert into auth.users (id, email) select id, id::text || '@test.invalid' from fake65;
insert into public.chat_call_presence (call_id, owner_id) select :'call', id from fake65 limit 13;
select test.as_user('a5c65001-0000-0000-0000-000000000001');
select test.check((select call_id = :'call' from public.chat_call_join((select id from g65 where key like 's-%'))), 'someone already in can rejoin');
reset role;
insert into public.chat_call_presence (call_id, owner_id) select :'call', id from fake65 offset 13 limit 1;
select test.as_user('a5c65002-0000-0000-0000-000000000002');
select public.chat_call_leave(:'call');
select test.refused($$select * from public.chat_call_join((select id from g65 where key like 's-%'))$$, 'a call is full at 15 people');
reset role;
delete from public.chat_call_presence where owner_id in (select id from fake65);

-- The monthly limit ------------------------------------------------------------------------------
update public.chat_call_presence set joined_at = now() - interval '50 minutes' where call_id = :'call' and owner_id = 'a5c65001-0000-0000-0000-000000000001' and left_at is null;
select test.as_user('a5c65005-0000-0000-0000-000000000005');
select test.check((select used >= 50 and monthly_limit = 4500 and calls >= 1 from public.chat_call_usage()), 'admins see minutes used this month and the limit');
update public.chat_settings set call_minutes_month = 40 where id;
select test.check((select call_minutes_month from public.chat_settings where id) = 40, 'admins change the monthly limit');
reset role;
select test.as_user('a5c65001-0000-0000-0000-000000000001');
select test.check(public.chat_call_heartbeat(:'call') = 'budget', 'when the limit is reached, the call ends');
update public.chat_settings set call_minutes_month = 99999 where id;
reset role;
select test.check((select call_minutes_month from public.chat_settings where id) = 40, 'students cannot change the limit');
reset role;
select test.as_user('a5c65002-0000-0000-0000-000000000002');
select test.refused($$select * from public.chat_call_join((select id from g65 where key like 's-%'))$$, 'and no new call starts until next month');
reset role;
update public.chat_settings set call_minutes_month = 4500 where id;

-- Calls last up to 3 hours; the call ends when the last person leaves.
select test.as_user('a5c65002-0000-0000-0000-000000000002');
select call_id as call2 from public.chat_call_join((select id from g65 where key like 's-%')) \gset
reset role;
update public.chat_calls set started_at = now() - interval '3 hours 1 minute' where id = :'call2';
select test.as_user('a5c65002-0000-0000-0000-000000000002');
select test.check(public.chat_call_heartbeat(:'call2') = 'too_long', 'a call ends after 3 hours');
select call_id as call3 from public.chat_call_join((select id from g65 where key like 's-%')) \gset
select public.chat_call_leave(:'call3');
reset role;
select test.check((select ended_at is not null from public.chat_calls where id = :'call3'), 'the call ends when the last person leaves');
