-- Permission tests at database level: the whole-library citation lookup (migration 16).
-- It answers only "is this name in approved material?", for signed-in users and the admin job,
-- and never counts material awaiting review or another course when a course is chosen.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000161', 'student161@test.invalid'),
  ('eeeeeeee-0000-0000-0000-000000000162', 'admin162@test.invalid');
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000162';

-- Made-up names. One approved item names the rules in full; one awaiting review names a case.
select test.as_user('eeeeeeee-0000-0000-0000-000000000162');
insert into public.kb_items (title, type, course_id)
  select 'Quokka approved', 'note', id from public.courses where slug = 'civil-litigation';
insert into public.kb_items (title, type, course_id)
  select 'Quokka pending', 'note', id from public.courses where slug = 'civil-litigation';
insert into public.kb_passages (item_id, position, heading, text)
  select id, 0, 'Renewal', 'Under the High Court of Quokka State (Civil Procedure) Rules, 2019, see Wombat v. D Numbat.'
  from public.kb_items where title = 'Quokka approved';
insert into public.kb_passages (item_id, position, heading, text)
  select id, 0, 'Pending', 'Dingo v Bilby is discussed here.' from public.kb_items where title = 'Quokka pending';
select test.make_reviewable('Quokka %');
update public.kb_items set review_status = 'approved' where title = 'Quokka approved';
reset role;

select test.as_user('cccccccc-0000-0000-0000-000000000161');
select test.check(
  (select array_agg(phrase order by phrase) from public.library_mentions(
     array['high court of quokka state civil procedure rules', 'invented quokka act'],
     array['wombat v numbat', 'dingo v bilby', 'kangaroo v emu']))
    = array['high court of quokka state civil procedure rules', 'wombat v numbat'],
  'a student''s answer keeps names the approved library has, and only those');
select test.check(
  (select count(*) from public.library_mentions(array[]::text[], array['dingo v bilby'])) = 0,
  'material awaiting review does not count');
select test.check(
  (select count(*) from public.library_mentions(
     array['high court of quokka state civil procedure rules'], array[]::text[],
     (select id from public.courses where slug = 'criminal-litigation'))) = 0,
  'with a course chosen, other courses do not count');
select test.check(
  (select count(*) from public.library_mentions(
     array['high court of quokka state civil procedure rules'], array[]::text[],
     (select id from public.courses where slug = 'civil-litigation'))) = 1,
  'the chosen course counts');
reset role;

do $$
begin
  perform test.as_user('cccccccc-0000-0000-0000-000000000161');
  begin
    perform * from public.library_mentions(array_fill('a'::text, array[31]), array[]::text[]);
    raise exception 'FAILED: too many names were accepted';
  exception when invalid_parameter_value then
    raise notice 'ok - too many names at once are refused';
  end;
  reset role;
end $$;

select test.as_anon();
select test.refused($$select * from public.library_mentions(array['x y'], array[]::text[])$$,
  'visitors cannot use the lookup');
reset role;

-- Test answers keep their wording before the check; reviewers read it but cannot change it.
insert into public.eval_runs (id, prompt_version, models, case_count)
  values ('11111111-0000-0000-0000-000000000161', 'explain-v2', array['claude-sonnet-5-5'], 1);
insert into public.eval_answers (run_id, case_id, case_kind, question, model, answer, raw_answer)
  values ('11111111-0000-0000-0000-000000000161', 'Q01', 'question', 'Q?', 'claude-sonnet-5-5', 'Checked.', 'Before the check.');
update public.profiles set role = 'reviewer' where id = 'eeeeeeee-0000-0000-0000-000000000162';
select test.as_user('eeeeeeee-0000-0000-0000-000000000162');
select test.check(
  (select raw_answer from public.eval_answers where run_id = '11111111-0000-0000-0000-000000000161') = 'Before the check.',
  'reviewers can read a test answer''s wording before the check');
select test.refused($$update public.eval_answers set raw_answer = 'changed'$$, 'reviewers cannot change it');
reset role;
select test.as_user('cccccccc-0000-0000-0000-000000000161');
select test.check(
  (select count(*) from public.eval_answers where run_id = '11111111-0000-0000-0000-000000000161') = 0,
  'students cannot see test answers');
reset role;
