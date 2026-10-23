-- Permission tests for the chat menu (⋯): rename, move to project, delete.
-- A student can do all three to their own chats only, and can never move a chat into
-- another student's project.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('c4a70001-0000-0000-0000-000000000001', 'menu-a@test.invalid'),
  ('c4a70002-0000-0000-0000-000000000002', 'menu-b@test.invalid');

-- Student A: a project and two chats --------------------------------------
select test.as_user('c4a70001-0000-0000-0000-000000000001');
insert into public.projects (name) values ('A revision');
insert into public.conversations (title) values ('A first chat'), ('A second chat');
insert into public.messages (conversation_id, role, content)
  select id, 'user', '{"text":"A question"}' from public.conversations where title = 'A second chat';

update public.conversations set title = 'A renamed chat' where title = 'A first chat';
select test.check(exists (select 1 from public.conversations where title = 'A renamed chat'), 'A can rename their own chat');

update public.conversations set project_id = (select id from public.projects) where title = 'A renamed chat';
select test.check(
  (select project_id from public.conversations where title = 'A renamed chat') = (select id from public.projects),
  'A can move their chat into their own project');

update public.conversations set project_id = null where title = 'A renamed chat';
select test.check(
  (select project_id from public.conversations where title = 'A renamed chat') is null,
  'A can take their chat out of a project');
reset role;

create table test.menu_ids as
  select (select id from public.projects where name = 'A revision') as project_id,
         (select id from public.conversations where title = 'A renamed chat') as chat_id;
grant select on test.menu_ids to authenticated;

-- Student B tries A's chats and A's project ---------------------------------
select test.as_user('c4a70002-0000-0000-0000-000000000002');
insert into public.conversations (title) values ('Menu B chat');

update public.conversations set title = 'hacked' where id = (select chat_id from test.menu_ids);
update public.conversations set project_id = null where id = (select chat_id from test.menu_ids);
delete from public.conversations where id = (select chat_id from test.menu_ids);
select test.refused(
  format('update public.conversations set project_id = %L where title = %L',
         (select project_id from test.menu_ids), 'Menu B chat'),
  'B cannot move their own chat into A''s project');
select test.refused(
  $$update public.conversations set owner_id = 'c4a70001-0000-0000-0000-000000000001' where title = 'Menu B chat'$$,
  'B cannot hand their chat to A');
reset role;

select test.check(
  (select title from public.conversations where id = (select chat_id from test.menu_ids)) = 'A renamed chat',
  'A''s chat is unchanged after B''s attempts');
select test.check(
  (select project_id from public.conversations where title = 'Menu B chat') is null,
  'B''s chat stayed out of A''s project');

-- Deleting a chat removes its messages --------------------------------------
select test.as_user('c4a70001-0000-0000-0000-000000000001');
delete from public.conversations where title = 'A second chat';
select test.check(not exists (select 1 from public.conversations where title = 'A second chat'), 'A can delete their own chat');
select test.check((select count(*) from public.messages) = 0, 'deleting a chat removes its messages');
reset role;

drop table test.menu_ids;
