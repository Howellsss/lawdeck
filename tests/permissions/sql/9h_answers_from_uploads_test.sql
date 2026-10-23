-- Permission tests at database level: answers from students' uploads (migration 26).
-- Phase 6 exit check: a second student can never be answered from another student's upload.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000261', 'studentA261@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000262', 'studentB262@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000263', 'reviewer263@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000263';

-- Student A has one Ready upload about numbat writs and one still being read ----------------
select test.as_user('cccccccc-0000-0000-0000-000000000261');
select public.accept_upload_notice();
insert into public.uploads (file_name, mime_type, size_bytes, storage_path) values
  ('Numbat notes.pdf', 'application/pdf', 100, 'cccccccc-0000-0000-0000-000000000261/n.pdf'),
  ('Unread notes.pdf', 'application/pdf', 100, 'cccccccc-0000-0000-0000-000000000261/u.pdf');
select public.replace_upload_passages((select id from public.uploads where file_name = 'Numbat notes.pdf'),
  '[{"heading": "Numbat writs", "text": "A numbat writ is renewed within twelve months."}]', 1, 1);
select public.finish_upload_reading((select id from public.uploads where file_name = 'Numbat notes.pdf'));
select public.replace_upload_passages((select id from public.uploads where file_name = 'Unread notes.pdf'),
  '[{"text": "Numbat writs unread draft."}]', 1, 1);
select test.check((select count(*) from public.search_uploads('numbat writ')) = 1,
  'a student finds their own Ready upload, not one still being read');
select test.check((select file_name from public.search_uploads('numbat writ')) = 'Numbat notes.pdf', 'the result names the file');
reset role;

-- Student B searching the same words finds nothing ------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000262');
select public.accept_upload_notice();
select test.check((select count(*) from public.search_uploads('numbat writ')) = 0,
  'another student is never answered from someone else''s upload');
reset role;
select test.as_user('dddddddd-0000-0000-0000-000000000263');
select test.check((select count(*) from public.search_uploads('numbat writ')) = 0, 'reviewers cannot search students'' uploads');
reset role;
select test.as_anon();
select test.refused($$select * from public.search_uploads('numbat')$$, 'visitors cannot search uploads');
reset role;

-- A's answer cites the upload; only A can open it ---------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000261');
insert into public.conversations (title) values ('Numbat chat');
select test.check((select use_uploads from public.conversations where title = 'Numbat chat'), 'chats use uploads unless turned off');
update public.conversations set use_uploads = false where title = 'Numbat chat';
select test.check(not (select use_uploads from public.conversations where title = 'Numbat chat'), 'a student turns uploads off for a chat');
insert into public.messages (conversation_id, role, content)
  select id, 'assistant', '{"text": "Twelve months [S1]."}' from public.conversations where title = 'Numbat chat';
insert into public.message_sources (message_id, label, origin, upload_passage_id, item_title, page_from, page_to)
  select m.id, 1, 'upload', p.id, 'Numbat notes.pdf', 1, 1
  from public.messages m, public.upload_passages p
  join public.uploads u on u.id = p.upload_id and u.file_name = 'Numbat notes.pdf'
  where m.content ->> 'text' = 'Twelve months [S1].';
select test.check((select available and text like 'A numbat writ%' from public.source_passage((select id from public.message_sources))),
  'the owner opens their upload source');
select test.refused($$insert into public.message_sources (message_id, label, origin, upload_passage_id, item_title)
  select m.id, 2, 'library', p.id, 'x' from public.messages m, public.upload_passages p limit 1$$,
  'a source marked as library cannot point at an upload');
reset role;
create table test.upload_source as select id from public.message_sources;
grant select on test.upload_source to authenticated;
do $$
declare a_passage uuid := (select p.id from public.upload_passages p join public.uploads u on u.id = p.upload_id where u.file_name = 'Numbat notes.pdf');
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000262');
  insert into public.conversations (title) values ('B chat');
  insert into public.messages (conversation_id, role, content) select id, 'assistant', '{"text": "x"}' from public.conversations;
  begin
    execute format($f$insert into public.message_sources (message_id, label, origin, upload_passage_id, item_title)
      select id, 1, 'upload', %L, 'stolen' from public.messages$f$, a_passage);
    raise exception 'FAILED: another student pointed a source at someone else''s upload';
  exception when foreign_key_violation or insufficient_privilege then
    raise notice 'ok - another student cannot cite someone else''s upload (refused)';
  end;
  reset role;
end $$;
select test.as_user('cccccccc-0000-0000-0000-000000000262');
select test.check((select count(*) from public.source_passage((select id from test.upload_source))) = 0,
  'another student cannot open someone else''s upload source');
reset role;

-- Deleting the upload leaves the source in place, shown as no longer available ----------------
select test.as_user('cccccccc-0000-0000-0000-000000000261');
delete from public.uploads where file_name = 'Numbat notes.pdf';
select test.check((select not available and text is null from public.source_passage((select id from test.upload_source))),
  'a deleted upload''s source shows as no longer available');
reset role;
