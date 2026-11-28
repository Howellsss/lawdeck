-- Database tests: 3-hour and weekly limits, the 7-day trial, and credits that start on the day a
-- student pays (migration 74).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a7400001-0000-0000-0000-000000000001', 'trial74@test.invalid'),
  ('a7400002-0000-0000-0000-000000000002', 'paid74@test.invalid'),
  ('a7400003-0000-0000-0000-000000000003', 'admin74@test.invalid');
update public.profiles set role = 'admin' where id = 'a7400003-0000-0000-0000-000000000003';

-- The plans ------------------------------------------------------------------------------------
select test.check(
  (select array_agg(name || ':' || monthly_message_limit || '/' || coalesce(weekly_credits, 0) || '/' || window_credits order by position) from public.plans where name in ('Free', 'Standard', 'Pro', 'Max'))
    = array['Free:30/0/7', 'Standard:70/25/8', 'Pro:150/50/15', 'Max:230/75/25'],
  'plans have monthly, weekly and 3-hour credits as the founder set them');

-- The 7-day trial -----------------------------------------------------------------------------
insert into public.usage_events (owner_id, kind, credits, created_at) values
  ('a7400001-0000-0000-0000-000000000001', 'explain', 1, now() - interval '4 hours'),
  ('a7400001-0000-0000-0000-000000000001', 'problem', 3, now() - interval '30 minutes'),
  ('a7400001-0000-0000-0000-000000000001', 'explain', 1, now() - interval '10 minutes');
select test.as_user('a7400001-0000-0000-0000-000000000001');
select test.check((select trial and monthly_limit = 30 from public.question_allowance()), 'a new student is on the 30-credit trial');
select test.check((select window_limit = 7 and window_used = 4 from public.question_allowance()),
  'the trial allows 7 credits every 3 hours, counting credits, not older use');
select test.check((select week_limit is null from public.question_allowance()), 'the trial has no weekly limit');
select test.check((select period_ends_at between now() + interval '6 days' and now() + interval '7 days' from public.question_allowance()),
  'the trial ends 7 days after it starts');
reset role;

update public.plans set trial_from = now() - interval '8 days' where name = 'Free';
update auth.users set created_at = now() - interval '8 days' where id = 'a7400001-0000-0000-0000-000000000001';
select test.as_user('a7400001-0000-0000-0000-000000000001');
select test.check((select monthly_limit = 0 from public.question_allowance()), 'after 7 days the trial gives no more credits');
reset role;
update public.plans set trial_from = now() where name = 'Free';

-- Migration 76: an account made before launch day gets its 7 days from launch day.
insert into auth.users (id, email, created_at) values ('a7600001-0000-0000-0000-000000000001', 'early76@test.invalid', now() - interval '20 days');
update public.plans set trial_from = now() + interval '2 days' where name = 'Free';
select test.as_user('a7600001-0000-0000-0000-000000000001');
select test.check(
  (select trial and monthly_limit = 30 and period_ends_at between now() + interval '8 days 23 hours' and now() + interval '9 days 1 hour' from public.question_allowance()),
  'an account made before launch gets its 7 days from launch day');
reset role;
update public.plans set trial_from = now() where name = 'Free';

-- Paid: credits from the day of payment, the week and the 3-hour window ------------------------
insert into public.usage_events (owner_id, kind, credits, created_at) values
  ('a7400002-0000-0000-0000-000000000002', 'explain', 1, now() - interval '12 days'),
  ('a7400002-0000-0000-0000-000000000002', 'draft', 3, now() - interval '9 days'),
  ('a7400002-0000-0000-0000-000000000002', 'explain', 1, now() - interval '2 days'),
  ('a7400002-0000-0000-0000-000000000002', 'marking', 3, now() - interval '1 hour'),
  ('a7400002-0000-0000-0000-000000000002', 'explain', 1, now() - interval '20 minutes');
-- Paid 10 days ago: the month started then, and this week started 3 days ago.
insert into public.subscriptions (owner_id, plan_id, status, amount_ngn, period_end, provider, provider_ref)
  select 'a7400002-0000-0000-0000-000000000002', id, 'active', 4999, now() - interval '10 days' + interval '1 month', 'flutterwave', '74000001'
    from public.plans where name = 'Standard';
select test.as_user('a7400002-0000-0000-0000-000000000002');
select test.check((select not trial and monthly_limit = 70 from public.question_allowance()), 'a Standard student has 70 credits a month');
select test.check((select used = 8 from public.question_allowance()), 'only credits used since the payment count (not those before it)');
select test.check((select week_limit = 25 and week_used = 5 from public.question_allowance()), 'the week counts 7-day blocks from the payment day');
select test.check((select window_limit = 8 and window_used = 4 and window_resets_at is null from public.question_allowance()),
  'Standard allows 8 credits every 3 hours');
reset role;

insert into public.usage_events (owner_id, kind, credits, created_at)
  select 'a7400002-0000-0000-0000-000000000002', 'problem', 3, now() - interval '5 minutes' from generate_series(1, 2);
select test.as_user('a7400002-0000-0000-0000-000000000002');
select test.check(
  (select window_used = 10 and window_resets_at between now() + interval '1 hour 50 minutes' and now() + interval '2 hours 10 minutes' from public.question_allowance()),
  'a full window says when it refills: 3 hours after its first use');
reset role;

insert into public.usage_events (owner_id, kind, credits, created_at)
  select 'a7400002-0000-0000-0000-000000000002', 'explain', 1, now() - interval '2 days' from generate_series(1, 15);
select test.as_user('a7400002-0000-0000-0000-000000000002');
select test.check(
  (select week_used = 26 and week_resets_at between now() + interval '3 days 23 hours' and now() + interval '4 days 1 hour' from public.question_allowance()),
  'a full week says when it refills');
reset role;

-- Admin → Plans --------------------------------------------------------------------------------
select test.as_user('a7400002-0000-0000-0000-000000000002');
select test.refused($$select public.save_plan_limits((select id from public.plans where name = 'Pro'), 1, 1)$$,
  'students cannot change limits');
reset role;
select test.as_user('a7400003-0000-0000-0000-000000000003');
select public.save_plan_limits((select id from public.plans where name = 'Pro'), 16, 55);
reset role;
select test.check((select window_credits = 16 and weekly_credits = 55 from public.plans where name = 'Pro'), 'an admin changes a plan''s limits');
select test.check((select count(*) = 1 from public.audit_log where action = 'plan_limits_changed'), 'the change is recorded in the audit log');
update public.plans set window_credits = 15, weekly_credits = 50 where name = 'Pro';
