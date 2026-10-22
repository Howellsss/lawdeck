-- Permission tests at database level: case and statute briefs (migration 18).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000181', 'studentA181@test.invalid'),
  ('cccccccc-0000-0000-0000-000000000182', 'studentB182@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000183', 'reviewer183@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000183';

-- Student A saves a brief ---------------------------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000181');
insert into public.briefs (kind, name, sections, sources)
  values ('case', 'Wombat v Numbat', '[{"heading": "Facts", "text": "Made-up facts [S1].", "covered": true}]',
          '[{"label": 1, "title": "Quokka notes"}]');
select test.check((select count(*) from public.briefs) = 1, 'a student saves a brief');
select test.refused($$update public.briefs set name = 'Changed'$$, 'a brief cannot be edited');
select test.refused($$insert into public.briefs (kind, name, sections) values ('case', 'Empty', '[]')$$,
  'a brief needs at least one section');
reset role;

-- Student B and a reviewer see and touch none of it ------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000182');
select test.check((select count(*) from public.briefs) = 0, 'another student cannot see the brief');
delete from public.briefs;
reset role;
select test.check((select count(*) from public.briefs) = 1, 'another student cannot delete the brief');
select test.as_user('dddddddd-0000-0000-0000-000000000183');
select test.check((select count(*) from public.briefs) = 0, 'reviewers cannot see students'' briefs');
reset role;

do $$
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000182');
  begin
    insert into public.briefs (owner_id, kind, name, sections)
      values ('cccccccc-0000-0000-0000-000000000181', 'case', 'Planted', '[{"heading": "Facts", "text": "x", "covered": true}]');
    raise exception 'FAILED: a student saved a brief as someone else';
  exception when insufficient_privilege or check_violation then
    raise notice 'ok - a student cannot save a brief as someone else (refused)';
  end;
  reset role;
end $$;

select test.as_anon();
select test.refused($$select * from public.briefs$$, 'visitors cannot read briefs');
reset role;

-- A brief counts as one question this month; the owner deletes their brief --------------------
select test.as_user('cccccccc-0000-0000-0000-000000000181');
select public.record_ai_usage('brief', 'claude-sonnet-5-5', 100, 50, 0.03, 1000);
select test.check((select used from public.question_allowance()) = 1, 'a brief counts toward the monthly allowance');
delete from public.briefs;
select test.check((select count(*) from public.briefs) = 0, 'a student deletes their own brief');
reset role;
