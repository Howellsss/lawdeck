-- Permission tests at database level (rules E-06, O-02): student workspace.
-- Two students, A and B: neither can read, change or delete the other's rows;
-- nobody can make themselves an admin; visitors who are not signed in see nothing.
\set ON_ERROR_STOP on
\set QUIET on

-- Two students sign up (the trigger must create their profiles) -------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.invalid'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.invalid');

select test.check((select count(*) from public.profiles) = 2, 'a profile is created for each new account');
select test.check(
  (select bool_and(role = 'student') from public.profiles), 'new accounts start as students');

-- Every table in public has row-level security on --------------------------
select test.check(
  not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
  'every table has row-level security switched on');

-- Student A creates work ----------------------------------------------------
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.projects (name) values ('A project');
insert into public.conversations (title, project_id)
  select 'A chat', id from public.projects where name = 'A project';
insert into public.messages (conversation_id, role, content)
  select id, 'user', '{"text":"A question"}' from public.conversations where title = 'A chat';
select test.check((select count(*) from public.projects) = 1, 'A sees their own project');
select test.check((select count(*) from public.messages) = 1, 'A sees their own message');
select test.check((select count(*) from public.profiles) = 1, 'A sees only their own profile');
select test.check((select count(*) from public.courses) = 5, 'signed-in students can read the five courses');
update public.profiles set full_name = 'Student A' where id = auth.uid();
select test.check((select full_name from public.profiles) = 'Student A', 'A can edit their own name');
reset role;

-- Remember A's ids for B's attempts.
create table test.ids as
  select (select id from public.projects) as project_id,
         (select id from public.conversations) as conversation_id;
grant select on test.ids to authenticated;

-- Student B tries to reach A's work ------------------------------------------
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.check((select count(*) from public.projects) = 0, 'B cannot see A''s projects');
select test.check((select count(*) from public.conversations) = 0, 'B cannot see A''s chats');
select test.check((select count(*) from public.messages) = 0, 'B cannot see A''s messages');
select test.check((select count(*) from public.profiles) = 1, 'B sees only their own profile');

update public.projects set name = 'hacked' where id = (select project_id from test.ids);
update public.conversations set title = 'hacked' where id = (select conversation_id from test.ids);
update public.profiles set full_name = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.projects where id = (select project_id from test.ids);
delete from public.conversations where id = (select conversation_id from test.ids);

select test.refused(
  format('insert into public.conversations (title, project_id) values (%L, %L)', 'B chat', (select project_id from test.ids)),
  'B cannot put a chat into A''s project');
select test.refused(
  format('insert into public.messages (conversation_id, role, content) values (%L, %L, %L)',
         (select conversation_id from test.ids), 'user', '{"text":"B"}'),
  'B cannot add a message to A''s chat');
select test.refused(
  $$insert into public.projects (owner_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'fake')$$,
  'B cannot create a project in A''s name');
select test.refused(
  $$update public.profiles set role = 'admin' where id = auth.uid()$$,
  'B cannot make themselves an admin');
select test.refused(
  $$update public.profiles set plan_id = gen_random_uuid() where id = auth.uid()$$,
  'B cannot change their own plan');
select test.refused($$insert into public.courses (slug, name) values ('fake', 'Fake')$$, 'students cannot add courses');
select test.refused($$update public.messages set content = '{}'$$, 'messages cannot be edited');
select test.refused(
  $$insert into public.usage_events (owner_id, kind) values (auth.uid(), 'fake')$$,
  'students cannot write usage records');
select test.refused($$select * from public.audit_log$$, 'students cannot read the audit log');
reset role;

select test.check(
  (select name from public.projects) = 'A project'
  and (select title from public.conversations) = 'A chat'
  and (select full_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Student A',
  'A''s work is unchanged after B''s attempts');

-- Visitors who are not signed in ----------------------------------------------
select test.as_anon();
select test.refused($$select * from public.profiles$$, 'visitors cannot read profiles');
select test.refused($$select * from public.projects$$, 'visitors cannot read projects');
select test.refused($$select * from public.messages$$, 'visitors cannot read messages');
select test.refused($$select * from public.courses$$, 'visitors cannot read courses');
reset role;

-- Deleting a project keeps its chats; deleting a chat removes its messages ---
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
delete from public.projects;
select test.check((select count(*) from public.conversations where project_id is null) = 1,
  'deleting a project keeps its chats');
delete from public.conversations;
select test.check((select count(*) from public.messages) = 0, 'deleting a chat removes its messages');
reset role;

select test.check(true, 'Workspace permission tests passed.');
