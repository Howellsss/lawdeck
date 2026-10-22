-- Permission tests at database level: answer quality test results (migration 15).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000151', 'student151@test.invalid'),
  ('dddddddd-0000-0000-0000-000000000152', 'reviewer152@test.invalid');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000152';

-- The marked admin job saves a run and an answer (here: the database owner) ---------------
insert into public.eval_runs (id, prompt_version, models, case_count)
  values ('11111111-0000-0000-0000-000000000151', 'explain-v2', array['claude-sonnet-5-5'], 1);
insert into public.eval_answers (id, run_id, case_id, case_kind, question, model, answer)
  values ('22222222-0000-0000-0000-000000000151', '11111111-0000-0000-0000-000000000151', 'Q01', 'question',
          'What is a writ?', 'claude-sonnet-5-5', 'An answer quoting the library.');

-- Students and visitors see nothing ------------------------------------------------------
select test.as_user('aaaaaaaa-0000-0000-0000-000000000151');
select test.check((select count(*) from public.eval_runs) = 0, 'students cannot see test runs');
select test.check((select count(*) from public.eval_answers) = 0, 'students cannot see test answers (they quote the library)');
update public.eval_answers set rating = 'approved';
reset role;
select test.check((select rating from public.eval_answers) is null, 'students cannot rate test answers');
select test.as_anon();
select test.refused($$select * from public.eval_answers$$, 'visitors cannot read test answers');
reset role;

-- The reviewer reads and rates -----------------------------------------------------------
select test.as_user('dddddddd-0000-0000-0000-000000000152');
select test.check((select count(*) from public.eval_answers) = 1, 'reviewers can read test answers');
update public.eval_answers set rating = 'needs_fix', review_note = 'Misses the Lagos time limit.';
select test.check(
  (select rating = 'needs_fix' and reviewed_by = 'dddddddd-0000-0000-0000-000000000152' and reviewed_at is not null
     from public.eval_answers),
  'a rating records who rated it and when');
select test.refused($$update public.eval_answers set answer = 'Rewritten'$$, 'reviewers cannot change the answer itself');
select test.refused($$update public.eval_answers set reviewed_by = null$$, 'reviewers cannot change who rated it');
select test.refused($$insert into public.eval_runs (prompt_version, models, case_count) values ('x', '{}', 0)$$,
  'only the admin job adds test runs');
select test.refused($$delete from public.eval_answers$$, 'reviewers cannot delete test answers');
reset role;
