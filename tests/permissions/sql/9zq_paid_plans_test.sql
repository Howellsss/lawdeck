-- Permission tests at database level: paid plans and credits (migration 68). Bigger jobs cost
-- more credits; a student is on a paid plan only while a paid month is running; nobody can give
-- themselves a plan or change the prices except an admin, and every price change is logged.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a6800001-0000-0000-0000-000000000001', 'student68a@test.invalid'),
  ('a6800002-0000-0000-0000-000000000002', 'student68b@test.invalid'),
  ('a6800003-0000-0000-0000-000000000003', 'reviewer68@test.invalid'),
  ('a6800004-0000-0000-0000-000000000004', 'admin68@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a6800003-0000-0000-0000-000000000003';
update public.profiles set role = 'admin' where id = 'a6800004-0000-0000-0000-000000000004';

create table test.plan68 as select id, name, monthly_message_limit as credits from public.plans;
grant select on test.plan68 to authenticated, anon;
create function test.free_price_refused() returns boolean language plpgsql as $$
begin
  perform public.save_plan((select id from test.plan68 where name = 'Free'), 500, 20);
  return false;
exception when sqlstate '22023' then
  return true;
end $$;
grant execute on function test.free_price_refused() to authenticated;

-- The plans and the credit costs -------------------------------------------------------------
select test.as_user('a6800001-0000-0000-0000-000000000001');
select test.check(
  (select array_agg(name || ':' || price_ngn order by position) from public.plans where on_sale)
    = array['Standard:4999', 'Pro:9999', 'Max:14999'],
  'three paid plans are on sale at the founder''s prices (2026-11-27, migration 74)');
select test.check((select credits from public.credit_costs where kind = 'problem') = 3, 'a student can read what each job costs');
select test.refused($$update public.credit_costs set credits = 0$$, 'a student cannot change what jobs cost');
select test.refused($$update public.plans set price_ngn = 1$$, 'a student cannot change a price');

-- Credits ----------------------------------------------------------------------------------------
select test.check((select name from public.my_plan()) = 'Free', 'a new student is on Free');
select test.check((select period_end from public.my_plan()) is null, 'Free has no end date');
select public.record_ai_usage('problem', 'claude-sonnet-5-5', 9000, 3000, 0.08, 30000);
select test.check((select used from public.question_allowance()) = 3, 'a problem question uses 3 credits');
select public.record_ai_usage('explain', 'claude-sonnet-5-5', 4000, 800, 0.02, 9000);
select test.check((select used from public.question_allowance()) = 4, 'an ordinary answer uses 1 credit');
reset role;
update public.credit_costs set credits = 5 where kind = 'problem';
select test.as_user('a6800001-0000-0000-0000-000000000001');
select test.check((select used from public.question_allowance()) = 4, 'changing a cost never changes credits already used');
reset role;
update public.credit_costs set credits = 3 where kind = 'problem';

-- Nobody can give themselves a plan ----------------------------------------------------------
select test.as_user('a6800001-0000-0000-0000-000000000001');
select test.refused(
  $$insert into public.subscriptions (owner_id, plan_id, status, period_end)
    select auth.uid(), id, 'active', now() + interval '30 days' from test.plan68 where name = 'Max'$$,
  'a student cannot record a payment for themselves');
select test.refused(
  $$update public.profiles set plan_id = (select id from test.plan68 where name = 'Max') where id = auth.uid()$$,
  'a student cannot put themselves on a paid plan');
select test.refused($$select public.current_plan_id(auth.uid())$$, 'a student cannot call the plan look-up directly');
select test.refused($$select public.save_plan((select id from test.plan68 where name = 'Max'), 1, 1000)$$,
  'a student cannot change a plan');
reset role;

-- A paid plan set on the profile without a payment gives nothing.
update public.profiles set plan_id = (select id from test.plan68 where name = 'Max')
 where id = 'a6800001-0000-0000-0000-000000000001';
select test.as_user('a6800001-0000-0000-0000-000000000001');
select test.check((select name from public.my_plan()) = 'Free', 'a paid plan without a paid month is Free');
reset role;
update public.profiles set plan_id = null where id = 'a6800001-0000-0000-0000-000000000001';

-- A paid month (recorded by the payment job) -------------------------------------------------
insert into public.subscriptions (owner_id, plan_id, status, amount_ngn, period_end, provider, provider_ref)
select 'a6800001-0000-0000-0000-000000000001', id, 'active', 3999, now() + interval '30 days', 'flutterwave', 'test-68-a'
  from test.plan68 where name = 'Standard';
select test.as_user('a6800001-0000-0000-0000-000000000001');
select test.check((select name from public.my_plan()) = 'Standard', 'after paying, the student is on Standard');
select test.check((select period_end from public.my_plan()) > now() + interval '29 days', 'the plan shows when the paid month ends');
select test.check(
  (select monthly_limit from public.question_allowance()) = (select credits from test.plan68 where name = 'Standard')
    or (select monthly_question_cap from public.pilot_settings where id) is not null,
  'the student gets Standard''s credits');
select test.check((select count(*) from public.subscriptions) = 1, 'a student sees their own payment');
reset role;

select test.as_user('a6800002-0000-0000-0000-000000000002');
select test.check((select name from public.my_plan()) = 'Free', 'one student''s payment never upgrades another');
select test.check((select count(*) from public.subscriptions) = 0, 'a student cannot see other people''s payments');
reset role;

-- The month ends, or the plan is cancelled: back to Free.
update public.subscriptions set period_end = now() - interval '1 minute' where provider_ref = 'test-68-a';
select test.as_user('a6800001-0000-0000-0000-000000000001');
select test.check((select name from public.my_plan()) = 'Free', 'when the paid month ends, the student is back on Free');
reset role;
update public.subscriptions set period_end = now() + interval '30 days', status = 'cancelled' where provider_ref = 'test-68-a';
select test.as_user('a6800001-0000-0000-0000-000000000001');
select test.check((select name from public.my_plan()) = 'Free', 'a cancelled payment gives no plan');
reset role;

-- Admin → Plans ------------------------------------------------------------------------------
select test.as_user('a6800003-0000-0000-0000-000000000003');
select test.refused($$select public.save_plan((select id from test.plan68 where name = 'Pro'), 1, 1000)$$,
  'a reviewer cannot change a plan');
reset role;

select test.as_user('a6800004-0000-0000-0000-000000000004');
select public.save_plan((select id from test.plan68 where name = 'Pro'), 8999, 200);
select test.check((select price_ngn = 8999 and monthly_message_limit = 200 from public.plans where name = 'Pro'),
  'an admin can change a plan''s price and credits');
select test.check(test.free_price_refused(), 'the Free plan cannot be given a price');
select public.save_plan((select id from test.plan68 where name = 'Pro'), 9999, 150);
reset role;
select test.check(
  (select count(*) from public.audit_log where action = 'plan_changed' and actor_id = 'a6800004-0000-0000-0000-000000000004') = 2,
  'every price change is recorded in the audit log');

select test.as_anon();
select test.refused($$select * from public.my_plan()$$, 'visitors have no plan');
reset role;
