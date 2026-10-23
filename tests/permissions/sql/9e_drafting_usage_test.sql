-- Permission tests at database level: drafting in the AI usage record (migration 23). A written
-- draft counts as one question; matching a request to a template is recorded but free.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000301', 'student301@test.invalid');

select test.as_user('cccccccc-0000-0000-0000-000000000301');
select test.check((select used from public.question_allowance()) = 0, 'a new student has used no questions');
select public.record_ai_usage('draft_pick', 'claude-haiku-5-5', 40, 5, 0.0001, 300);
select test.check((select used from public.question_allowance()) = 0, 'matching a request to a template is free');
select public.record_ai_usage('draft', 'claude-opus-5-5', 3000, 2000, 0.05, 20000);
select test.check((select used from public.question_allowance()) = 1, 'a written draft counts as one question');
select test.check((select count(*) from public.usage_events) = 2, 'both drafting calls are recorded for the student');
do $$
begin
  perform public.record_ai_usage('drafting', 'x', 1, 1, 0, 1);
  raise exception 'FAIL - an unknown kind of AI call is refused';
exception when invalid_parameter_value then
  raise notice 'ok - an unknown kind of AI call is refused';
end;
$$;
reset role;

select test.as_anon();
select test.refused($$select public.record_ai_usage('draft', 'x', 1, 1, 0, 1)$$, 'visitors cannot record AI usage');
reset role;
