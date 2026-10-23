-- Permission tests at database level: view-only share links (migration 27). Made-up names only.
-- Phase 6 exit check: revoking a share stops access immediately.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000271', 'studentA271@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000272', 'studentB272@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000273', 'studentC273@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000274', 'reviewer274@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000274';
update public.profiles set full_name = 'Bisi Quokka' where id = 'cccccccc-0000-0000-0000-000000000272';

-- A reviewer approves a template; student A drafts two documents, one in a project, and a chat --
select test.as_user('dddddddd-0000-0000-0000-000000000274');
insert into public.templates (slug, title, course_id, spec, rule_source)
  select 'quokka-share', 'Quokka notice', id, '{"parts": [{"id": "a"}]}', 'Quokka Rules' from public.courses where slug = 'civil-litigation';
update public.templates set status = 'approved' where slug = 'quokka-share';
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000271');
insert into public.projects (name) values ('Quokka file');
insert into public.documents (project_id, template_id, title)
  select p.id, t.id, 'Shared notice' from public.projects p, public.templates t where p.name = 'Quokka file' and t.slug = 'quokka-share';
insert into public.documents (template_id, title) select id, 'Private notice' from public.templates where slug = 'quokka-share';
insert into public.document_versions (document_id, content, created_by) select id, '{"fields": {"x": "1"}}', 'student' from public.documents;
insert into public.conversations (title, project_id) select 'Quokka chat', id from public.projects;
insert into public.messages (conversation_id, role, content) select id, 'user', '{"text": "What is a quokka writ?"}' from public.conversations;
insert into public.shares (kind, project_id) select 'project', id from public.projects where name = 'Quokka file';
insert into public.shares (kind, document_id) select 'document', id from public.documents where title = 'Private notice';
select test.check((select count(*) from public.shares) = 2, 'a student creates share links');
select test.check((select bool_and(token ~ '^[0-9a-f]{64}$') from public.shares), 'each link has a long random token');
select test.refused($$update public.shares set token = repeat('a', 64)$$, 'a token cannot be changed');
reset role;
create table test.share_links as select kind, token, document_id, project_id from public.shares;
grant select on test.share_links to authenticated;

-- Student B cannot create links to A's work or see A's links -----------------------------------
do $$
declare a_doc uuid := (select id from public.documents where title = 'Private notice');
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000272');
  begin
    execute format('insert into public.shares (kind, document_id) values (%L, %L)', 'document', a_doc);
    raise exception 'FAILED: a student shared someone else''s document';
  exception when foreign_key_violation or insufficient_privilege then
    raise notice 'ok - a student cannot share someone else''s document (refused)';
  end;
  reset role;
end $$;
select test.as_user('cccccccc-0000-0000-0000-000000000272');
select test.check((select count(*) from public.shares) = 0, 'another student cannot see someone else''s links');

-- ...but B can open the links A sent: read-only -------------------------------------------------
select test.check((select title from public.open_share((select token from test.share_links where kind = 'project'))) = 'Quokka file',
  'a signed-in student opens a shared project');
select test.check((select count(*) from public.shared_project_items((select token from test.share_links where kind = 'project'))) = 2,
  'the shared project lists its document and chat');
reset role;
create table test.share_docs as select id, title from public.documents;
create table test.share_chat as select id from public.conversations where title = 'Quokka chat';
grant select on test.share_docs, test.share_chat to authenticated;
select test.as_user('cccccccc-0000-0000-0000-000000000272');
select test.check((select title from public.shared_document((select token from test.share_links where kind = 'project'),
  (select id from test.share_docs where title = 'Shared notice'))) = 'Shared notice', 'a document in the shared project can be read');
select test.check((select count(*) from public.shared_document((select token from test.share_links where kind = 'project'),
  (select id from test.share_docs where title = 'Private notice'))) = 0, 'a document outside the shared project cannot');
select test.check((select count(*) from public.shared_chat_messages((select token from test.share_links where kind = 'project'),
  (select id from test.share_chat))) = 1, 'a chat in the shared project can be read');
select test.check((select count(*) from public.documents) + (select count(*) from public.projects) = 0,
  'opening a link gives no direct access to the owner''s work');
update public.documents set title = 'Hijacked';
select test.check((select count(*) from public.open_share(repeat('0', 64))) = 0, 'a made-up token opens nothing');
reset role;
select test.check((select count(*) from public.documents where title = 'Hijacked') = 0, 'a viewer cannot change shared work');

-- The owner sees who opened the link; nobody else can ------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000271');
select test.check((select viewer_name from public.share_viewers((select id from public.shares where kind = 'project'))) = 'Bisi Quokka',
  'the owner sees who opened the link');
select test.check((select is_owner from public.open_share((select token from test.share_links where kind = 'project'))),
  'the owner opening their own link is not recorded as a viewer');
select test.check((select count(*) from public.share_viewers((select id from public.shares where kind = 'project'))) = 1,
  'only other people are listed');
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000273');
select test.check((select count(*) from public.share_viewers((select s.id from public.shares s limit 1))) = 0,
  'nobody else can see who opened a link');
reset role;

-- Revoking stops access at once, and a revoked link stays revoked --------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000271');
update public.shares set revoked_at = now() where kind = 'project';
update public.shares set revoked_at = null where kind = 'project';
select test.check((select revoked_at is not null from public.shares where kind = 'project'), 'a revoked link stays revoked');
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000272');
select test.check((select count(*) from public.open_share((select token from test.share_links where kind = 'project'))) = 0,
  'revoking a share stops access immediately');
select test.check((select count(*) from public.shared_document((select token from test.share_links where kind = 'project'),
  (select id from test.share_docs where title = 'Shared notice'))) = 0, 'a revoked link no longer shows its documents');
select test.check((select count(*) from public.shared_project_items((select token from test.share_links where kind = 'project'))) = 0,
  'a revoked link no longer lists the project');
select test.check((select title from public.open_share((select token from test.share_links where kind = 'document'))) = 'Private notice',
  'other links keep working');
reset role;

-- Visitors who are not signed in get nothing ------------------------------------------------------
select test.as_anon();
select test.refused($$select * from public.open_share(repeat('0', 64))$$, 'visitors cannot open shared work');
select test.refused($$select * from public.shares$$, 'visitors cannot read share links');
reset role;

-- Deleting the document removes its link ------------------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000271');
delete from public.documents where title = 'Private notice';
select test.check((select count(*) from public.shares where kind = 'document') = 0, 'deleting a document removes its share link');
reset role;
