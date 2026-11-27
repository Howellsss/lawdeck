-- Database tests: paying for a plan with Flutterwave (migration 73). Students start payments for
-- plans on sale; only the marked admin job records a paid month, once, for the right amount.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a7300001-0000-0000-0000-000000000001', 'payer73@test.invalid'),
  ('a7300002-0000-0000-0000-000000000002', 'other73@test.invalid');

create function test.ref73(n integer) returns text language sql security definer as $$
  select tx_ref from public.payments where owner_id = 'a7300001-0000-0000-0000-000000000001' order by created_at, tx_ref offset n limit 1
$$;
grant usage on schema test to service_role;
grant execute on function test.ref73(integer) to authenticated, service_role;

-- Starting payments ---------------------------------------------------------------------------
select test.as_user('a7300001-0000-0000-0000-000000000001');
select test.check(
  (select amount_ngn = (select price_ngn from public.plans where name = 'Standard') and plan_name = 'Standard'
     from public.start_payment((select id from public.plans where name = 'Standard'))),
  'a student starts paying for Standard at its price');
select test.check((select count(*) = 1 and bool_and(status = 'pending') from public.payments), 'the student sees their own pending payment');
do $$
begin
  perform * from public.start_payment((select id from public.plans where name = 'Free'));
  raise exception 'FAILED: the Free plan cannot be bought (was allowed)';
exception when invalid_parameter_value then
  raise notice 'ok - the Free plan cannot be bought (refused)';
end $$;
select test.refused($$insert into public.payments (owner_id, plan_id, amount_ngn, tx_ref)
  select 'a7300001-0000-0000-0000-000000000001', id, 1, 'ldk_00000000000000000000000000000000' from public.plans where name = 'Max'$$,
  'students cannot write payments themselves');
select test.refused($$update public.payments set status = 'paid'$$, 'students cannot mark a payment paid');
select test.refused($$select * from public.record_payment(test.ref73(0), '123456', 100000, 'NGN')$$,
  'students cannot record a paid month');
select test.refused($$select public.fail_payment(test.ref73(0))$$, 'students cannot fail a payment');
select test.refused($$insert into public.subscriptions (owner_id, plan_id, status, period_end)
  select 'a7300001-0000-0000-0000-000000000001', id, 'active', now() + interval '1 month' from public.plans where name = 'Max'$$,
  'students cannot give themselves a plan');
reset role;

select test.as_user('a7300002-0000-0000-0000-000000000002');
select test.check((select count(*) = 0 from public.payments), 'another student cannot see the payment');
reset role;

select test.as_anon();
select test.refused($$select * from public.start_payment((select id from public.plans where name = 'Standard'))$$,
  'visitors cannot start a payment');
reset role;

-- Recording payments (the marked admin job) ---------------------------------------------------
set role service_role;
do $$
begin
  perform * from public.record_payment(test.ref73(0), '9000001', 10, 'NGN');
  raise exception 'FAILED: too small an amount is refused (was allowed)';
exception when invalid_parameter_value then
  raise notice 'ok - too small an amount is refused (refused)';
end $$;
do $$
begin
  perform * from public.record_payment(test.ref73(0), '9000001', 100000, 'USD');
  raise exception 'FAILED: another currency is refused (was allowed)';
exception when invalid_parameter_value then
  raise notice 'ok - another currency is refused (refused)';
end $$;
select test.check(
  (select plan_name = 'Standard' and period_end > now() + interval '27 days'
     from public.record_payment(test.ref73(0), '9000001', (select price_ngn from public.plans where name = 'Standard'), 'NGN')),
  'a confirmed payment gives one paid month of the plan');
select test.check(
  (select count(*) = 1 from public.record_payment(test.ref73(0), '9000001', (select price_ngn from public.plans where name = 'Standard'), 'NGN')),
  'the same payment recorded again answers the same');
select test.check((select count(*) = 1 from public.subscriptions where owner_id = 'a7300001-0000-0000-0000-000000000001'),
  'the same payment never gives a second month');
do $$
begin
  perform * from public.record_payment(test.ref73(0), '9000002', 100000, 'NGN');
  raise exception 'FAILED: a paid payment cannot take another transaction (was allowed)';
exception when unique_violation then
  raise notice 'ok - a paid payment cannot take another transaction (refused)';
end $$;
reset role;

-- Paying early adds a month on top of the one already running.
select test.as_user('a7300001-0000-0000-0000-000000000001');
select * from public.start_payment((select id from public.plans where name = 'Standard'));
select test.check((select name = 'Standard' from public.my_plan()), 'the student is on Standard after paying');
reset role;
set role service_role;
select test.check(
  (select period_end > now() + interval '55 days'
     from public.record_payment(test.ref73(1), '9000003', (select price_ngn from public.plans where name = 'Standard'), 'NGN')),
  'paying again before the month ends starts the new month when the current one ends');
do $$
begin
  perform * from public.record_payment(test.ref73(0), '9000003', 100000, 'NGN');
  raise exception 'FAILED: one Flutterwave transaction gives one month only (was allowed)';
exception when unique_violation then
  raise notice 'ok - one Flutterwave transaction gives one month only (refused)';
end $$;
reset role;

-- A failed payment stays failed and gives nothing.
select test.as_user('a7300001-0000-0000-0000-000000000001');
select * from public.start_payment((select id from public.plans where name = 'Pro'));
reset role;
set role service_role;
select public.fail_payment(test.ref73(2));
reset role;
select test.check((select status = 'failed' from public.payments where tx_ref = test.ref73(2)), 'a failed payment is recorded as failed');
select test.check((select count(*) = 2 from public.subscriptions where owner_id = 'a7300001-0000-0000-0000-000000000001'),
  'a failed payment gives no month');

-- Migration 75: only payments still waiting count towards the 10 an hour.
insert into auth.users (id, email) values ('a7500001-0000-0000-0000-000000000001', 'retry75@test.invalid');
select test.as_user('a7500001-0000-0000-0000-000000000001');
select (public.start_payment((select id from public.plans where name = 'Standard'))).tx_ref from generate_series(1, 10);
do $$
begin
  perform * from public.start_payment((select id from public.plans where name = 'Standard'));
  raise exception 'FAILED: an 11th waiting payment in an hour is refused (was allowed)';
exception when sqlstate '54000' then
  raise notice 'ok - an 11th waiting payment in an hour is refused (refused)';
end $$;
reset role;
set role service_role;
select public.fail_payment(tx_ref) from public.payments where owner_id = 'a7500001-0000-0000-0000-000000000001';
reset role;
select test.as_user('a7500001-0000-0000-0000-000000000001');
select test.check((select count(*) = 1 from public.start_payment((select id from public.plans where name = 'Standard'))),
  'failed attempts do not use up the hourly limit');
reset role;
