-- Permission tests at database level: forums, templates, documents and versions (migration 21).
-- Phase 5 rules: students only ever see approved templates and forums (H-05); documents are
-- their owner's alone. Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000211', 'studentA211@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000212', 'studentB212@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000213', 'reviewer213@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000214', 'admin214@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000213';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000214';

-- A reviewer adds a court and a template; both start as drafts ---------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000213');
insert into public.forums (slug, name, kind, state, profile) values
  ('quokka-high-court', 'High Court of Quokka State', 'court', 'Quokka', '{"paper": "A4", "font": "Times New Roman"}'),
  ('wombat-registry', 'Wombat Lands Registry', 'registry', 'Wombat', '{"paper": "A4"}');
insert into public.forums (slug, name, kind) values ('empty-court', 'Empty Court', 'court');
insert into public.templates (slug, title, course_id, spec)
  select 'quokka-writ', 'Quokka writ', id, '{"parts": [{"id": "heading"}]}' from public.courses where slug = 'civil-litigation';
insert into public.template_forums (template_id, forum_id)
  select t.id, f.id from public.templates t, public.forums f where t.slug = 'quokka-writ' and f.slug = 'quokka-high-court';
select test.refused($$update public.templates set status = 'approved' where slug = 'quokka-writ'$$,
  'a template without its rule source cannot be approved');
select test.refused($$update public.forums set status = 'approved' where slug = 'empty-court'$$,
  'a forum without a formatting profile cannot be approved');
reset role;

-- Students see no drafts and cannot draft from them --------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000211');
select test.check((select count(*) from public.templates) = 0, 'students cannot see draft templates');
select test.check((select count(*) from public.forums) = 0, 'students cannot see draft forums');
select test.check((select count(*) from public.template_forums) = 0, 'students cannot see draft template links');
reset role;
do $$
declare draft_template uuid := (select id from public.templates where slug = 'quokka-writ');
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000211');
  begin
    execute format('insert into public.documents (template_id, title) values (%L, %L)', draft_template, 'Sneaky writ');
    raise exception 'FAILED: a student made a document from a draft template';
  exception when insufficient_privilege then
    raise notice 'ok - a student cannot make a document from a draft template (refused)';
  end;
  reset role;
end $$;

-- The reviewer completes and approves them; the database records who and when -------------
select test.as_user('dddddddd-0000-0000-0000-000000000213');
update public.templates set rule_source = 'Quokka (Civil Procedure) Rules, Form 1' where slug = 'quokka-writ';
update public.templates set status = 'approved' where slug = 'quokka-writ';
update public.forums set status = 'approved' where slug in ('quokka-high-court', 'wombat-registry');
select test.check((select reviewed_by = 'dddddddd-0000-0000-0000-000000000213' and reviewed_at is not null
                   from public.templates where slug = 'quokka-writ'), 'approving a template records the reviewer');
select test.check((select version from public.templates where slug = 'quokka-writ') = 1,
  'a template keeps its version when only its rule source changes');
reset role;

-- Students read approved ones but cannot change them ----------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000211');
select test.check((select count(*) from public.templates) = 1, 'students see approved templates');
select test.check((select count(*) from public.forums) = 2, 'students see approved forums only');
select test.check((select count(*) from public.template_forums) = 1, 'students see which courts a template is for');
select test.refused($$insert into public.templates (slug, title, course_id, spec)
  select 'mine', 'Mine', id, '{"parts": []}' from public.courses limit 1$$, 'students cannot write templates');
select test.refused($$insert into public.forums (slug, name, kind) values ('my-court', 'My court', 'court')$$,
  'students cannot write forums');
update public.templates set title = 'Changed';
update public.forums set name = 'Changed';
reset role;
select test.check((select title from public.templates where slug = 'quokka-writ') = 'Quokka writ',
  'students cannot change a template');
select test.check((select count(*) from public.forums where name = 'Changed') = 0, 'students cannot change a forum');

-- Student A drafts a document; versions are numbered and the newest is current -------------
select test.as_user('cccccccc-0000-0000-0000-000000000211');
insert into public.projects (name) values ('Quokka case file');
insert into public.documents (project_id, template_id, forum_id, title)
  select p.id, t.id, f.id, 'Writ for Quokka v Numbat'
  from public.projects p, public.templates t, public.forums f
  where p.name = 'Quokka case file' and t.slug = 'quokka-writ' and f.slug = 'quokka-high-court';
insert into public.document_versions (document_id, content, created_by, model)
  select id, '{"fields": {"claimant": "Quokka"}}', 'ai', 'test-model' from public.documents;
insert into public.document_versions (document_id, content, created_by)
  select id, '{"fields": {"claimant": "Quokka Ltd"}}', 'student' from public.documents;
select test.check((select array_agg(number order by number) from public.document_versions) = '{1,2}',
  'versions are numbered 1, 2 by the database');
select test.check((select d.current_version_id = v.id from public.documents d
                   join public.document_versions v on v.document_id = d.id and v.number = 2),
  'the newest version becomes the current one');
select test.check((select template_version from public.documents) = 1, 'the document records the template version');
update public.documents set title = 'Writ (renamed)';
select test.check((select title from public.documents) = 'Writ (renamed)', 'a student renames their document');
update public.documents set current_version_id = (select id from public.document_versions where number = 1);
select test.check((select v.number from public.documents d join public.document_versions v on v.id = d.current_version_id) = 1,
  'a student can go back to an earlier version');
select test.refused($$update public.document_versions set content = '{}'$$, 'a version can never be edited');
select test.refused($$insert into public.documents (template_id, forum_id, title)
  select t.id, f.id, 'Wrong court' from public.templates t, public.forums f
  where t.slug = 'quokka-writ' and f.slug = 'wombat-registry'$$,
  'a document can only use a court or registry the template is for');
select test.refused($$insert into public.documents (title) values ('No template')$$,
  'a document must come from a template');
reset role;

-- Student B sees and touches none of it ----------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000212');
select test.check((select count(*) from public.documents) = 0, 'another student cannot see the document');
select test.check((select count(*) from public.document_versions) = 0, 'another student cannot see its versions');
update public.documents set title = 'Hijacked';
delete from public.documents;
insert into public.projects (name) values ('B''s file');
reset role;
select test.check((select title from public.documents where owner_id = 'cccccccc-0000-0000-0000-000000000211') = 'Writ (renamed)',
  'another student cannot rename or delete the document');

do $$
declare a_doc uuid := (select id from public.documents where owner_id = 'cccccccc-0000-0000-0000-000000000211');
declare b_project uuid := (select id from public.projects where name = 'B''s file');
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000212');
  begin
    execute format('insert into public.document_versions (document_id, content, created_by) values (%L, %L, %L)',
                   a_doc, '{"fields": {}}', 'student');
    raise exception 'FAILED: another student added a version';
  exception when foreign_key_violation or insufficient_privilege then
    raise notice 'ok - another student cannot add a version to the document (refused)';
  end;
  reset role;
  perform test.as_user('cccccccc-0000-0000-0000-000000000211');
  begin
    execute format('update public.documents set project_id = %L', b_project);
    raise exception 'FAILED: a document moved into another student''s project';
  exception when foreign_key_violation or insufficient_privilege then
    raise notice 'ok - a document cannot join another student''s project (refused)';
  end;
  reset role;
end $$;

-- Staff never see students' documents -----------------------------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000213');
select test.check((select count(*) from public.documents) + (select count(*) from public.document_versions) = 0,
  'reviewers cannot see students'' documents');
reset role;
select test.as_user('eeeeeeee-0000-0000-0000-000000000214');
select test.check((select count(*) from public.documents) = 0, 'admins cannot see students'' documents');
reset role;

-- Changing an approved template puts it back to draft and raises its version ---------------
select test.as_user('dddddddd-0000-0000-0000-000000000213');
update public.templates set spec = '{"parts": [{"id": "heading"}, {"id": "body"}]}' where slug = 'quokka-writ';
select test.check((select status = 'pending' and reviewed_by is null and version = 2 from public.templates where slug = 'quokka-writ'),
  'changing an approved template puts it back to draft as version 2');
update public.forums set profile = '{"paper": "Letter"}' where slug = 'quokka-high-court';
select test.check((select status = 'pending' from public.forums where slug = 'quokka-high-court'),
  'changing an approved forum puts it back to draft');
delete from public.templates;
reset role;
select test.check((select count(*) from public.templates) = 1, 'reviewers cannot delete templates');
select test.as_user('cccccccc-0000-0000-0000-000000000211');
select test.check((select count(*) from public.templates) = 0, 'students no longer see a template sent back to draft');
select test.check((select count(*) from public.documents) = 1, 'the student keeps their document');
reset role;

-- Admins remove templates; documents keep their text --------------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000214');
delete from public.templates where slug = 'quokka-writ';
reset role;
select test.check((select template_id is null from public.documents where owner_id = 'cccccccc-0000-0000-0000-000000000211'),
  'removing a template leaves students'' documents in place');

-- Visitors get nothing ---------------------------------------------------------------------
select test.as_anon();
select test.refused($$select * from public.templates$$, 'visitors cannot read templates');
select test.refused($$select * from public.forums$$, 'visitors cannot read forums');
select test.refused($$select * from public.documents$$, 'visitors cannot read documents');
reset role;

-- Deleting a document removes its versions -------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000211');
delete from public.documents;
select test.check((select count(*) from public.document_versions) = 0, 'deleting a document removes its versions');
reset role;
