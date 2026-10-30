-- Permission tests at database level: usage and cost per person for admins (migration 41).
-- Only admins see who spent what and which courses they study; never question text.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000901', 'ada.adminusage@test.invalid', '{"full_name": "Ada Usage"}'),
  ('cccccccc-0000-0000-0000-000000000902', 'bayo.adminusage@test.invalid', '{}'),
  ('dddddddd-0000-0000-0000-000000000904', 'reviewer.adminusage@test.invalid', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000905', 'admin.adminusage@test.invalid', '{}');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000904';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000905';

-- Ada: two answers and a voice reply today, one answer 40 days ago. Bayo: one cheap answer.
insert into public.usage_events (owner_id, kind, model, cost_usd, created_at) values
  ('cccccccc-0000-0000-0000-000000000901', 'explain', 'test', 0.03, now()),
  ('cccccccc-0000-0000-0000-000000000901', 'explain', 'test', 0.05, now()),
  ('cccccccc-0000-0000-0000-000000000901', 'speech', 'test', 0.01, now()),
  ('cccccccc-0000-0000-0000-000000000901', 'explain', 'test', 0.50, now() - interval '40 days'),
  ('cccccccc-0000-0000-0000-000000000902', 'explain', 'test', 0.02, now());

-- Ada has one Civil Litigation chat with two questions and one all-courses chat with one.
insert into public.courses (slug, name) values ('usage-test-civil', 'Usage Test Civil');
select test.as_user('cccccccc-0000-0000-0000-000000000901');
insert into public.conversations (title, course_id) values
  ('Usage civil chat', (select id from public.courses where slug = 'usage-test-civil')),
  ('Usage all chat', null);
insert into public.messages (conversation_id, role, content)
  select c.id, v.role::public.message_role, v.content::jsonb
    from public.conversations c
    join (values ('Usage civil chat', 'user', '{"text": "one"}'), ('Usage civil chat', 'assistant', '{"text": "answer"}'),
                 ('Usage civil chat', 'user', '{"text": "two"}'), ('Usage all chat', 'user', '{"text": "three"}')) v (title, role, content)
      on v.title = c.title;

-- Students, reviewers and visitors see nothing ------------------------------------------------
select test.refused($$select * from public.admin_usage_ranking(30)$$, 'students cannot see who spends what');
select test.refused($$select * from public.admin_user_usage('cccccccc-0000-0000-0000-000000000902')$$, 'students cannot see another person''s usage');
select test.refused($$select * from public.admin_user_usage('cccccccc-0000-0000-0000-000000000901')$$, 'students cannot use the admin usage page even for themselves');
select test.refused($$select * from public.admin_user_usage_daily('cccccccc-0000-0000-0000-000000000902')$$, 'students cannot see another person''s daily cost');
select test.refused($$select * from public.admin_user_courses('cccccccc-0000-0000-0000-000000000902')$$, 'students cannot see what another person studies');
reset role;

select test.as_user('dddddddd-0000-0000-0000-000000000904');
select test.refused($$select * from public.admin_usage_ranking(30)$$, 'reviewers cannot see who spends what');
select test.refused($$select * from public.admin_user_courses('cccccccc-0000-0000-0000-000000000901')$$, 'reviewers cannot see what people study');
reset role;

select test.as_anon();
select test.refused($$select * from public.admin_usage_ranking(30)$$, 'visitors cannot see who spends what');
select test.refused($$select * from public.admin_user_usage('cccccccc-0000-0000-0000-000000000901')$$, 'visitors cannot see anyone''s usage');
reset role;

-- The admin sees usage and cost -----------------------------------------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000905');
select test.check((select email from public.admin_usage_ranking(30) where email like '%adminusage%' limit 1) = 'ada.adminusage@test.invalid', 'the highest spender comes first');
select test.check((select cost_usd from public.admin_usage_ranking(30) where email = 'ada.adminusage@test.invalid') = 0.09, 'the ranking counts only the chosen days');
select test.check((select questions from public.admin_usage_ranking(30) where email = 'ada.adminusage@test.invalid') = 2, 'voice audio is not counted as a question');
select test.check((select full_name from public.admin_usage_ranking(30) where email = 'ada.adminusage@test.invalid') = 'Ada Usage', 'names are shown');
select test.check((select cost_total from public.admin_user_usage('cccccccc-0000-0000-0000-000000000901') where kind = 'explain') = 0.58, 'the total cost of answers is ever');
select test.check((select calls_30d from public.admin_user_usage('cccccccc-0000-0000-0000-000000000901') where kind = 'explain') = 2, 'answers in the last 30 days are counted');
select test.check((select count(*) from public.admin_user_usage_daily('cccccccc-0000-0000-0000-000000000901', 30)) = 30, 'every day of the period is listed, used or not');
select test.check((select sum(cost_usd) from public.admin_user_usage_daily('cccccccc-0000-0000-0000-000000000901', 30)) = 0.09, 'the daily costs add up to the period''s cost');
select test.check((select questions from public.admin_user_courses('cccccccc-0000-0000-0000-000000000901') where course = 'Usage Test Civil') = 2, 'questions per course count only the student''s messages');
select test.check((select chats from public.admin_user_courses('cccccccc-0000-0000-0000-000000000901') where course = 'All courses') = 1, 'chats across all courses are grouped together');
-- Bad inputs stop with "invalid value" (22023).
do $$
begin
  begin perform * from public.admin_usage_ranking(0); raise exception 'FAILED: a period of zero days is refused';
  exception when invalid_parameter_value then raise notice 'ok - a period of zero days is refused'; end;
  begin perform * from public.admin_user_usage_daily('cccccccc-0000-0000-0000-000000000901', 91); raise exception 'FAILED: more than 90 days is refused';
  exception when invalid_parameter_value then raise notice 'ok - more than 90 days is refused'; end;
end $$;
reset role;
