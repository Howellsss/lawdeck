-- Permission tests at database level: the admin Users dashboard (migration 34).
-- Only admins see people's emails, plans, payments and usage; students and reviewers see nothing;
-- students read only their own subscriptions and nobody writes subscriptions from the app.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, created_at, last_sign_in_at, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000701', 'ada.adminusers@test.invalid', now() - interval '2 days', now(), now(), '{"provider": "google"}', '{"full_name": "Ada Obi"}'),
  ('cccccccc-0000-0000-0000-000000000702', 'bayo.adminusers@test.invalid', now(), null, null, '{"provider": "email"}', '{}'),
  ('cccccccc-0000-0000-0000-000000000703', 'chi_100%.adminusers@test.invalid', now() - interval '40 days', null, now(), '{}', '{}'),
  ('dddddddd-0000-0000-0000-000000000704', 'reviewer.adminusers@test.invalid', now(), null, now(), '{}', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000705', 'admin.adminusers@test.invalid', now(), null, now(), '{}', '{}');
update public.profiles set role = 'reviewer' where id = 'dddddddd-0000-0000-0000-000000000704';
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-0000-0000-000000000705';
update public.profiles set created_at = now() - interval '2 days' where id = 'cccccccc-0000-0000-0000-000000000701';
update public.profiles set created_at = now() - interval '40 days' where id = 'cccccccc-0000-0000-0000-000000000703';
-- Bayo chose a name on the Account page; it wins over the sign-in name.
update public.profiles set full_name = 'Bayo Ade' where id = 'cccccccc-0000-0000-0000-000000000702';

-- A paid plan, and payment records as the payment provider's job would write them.
insert into public.plans (name, price_ngn, monthly_message_limit, upload_limit) values ('Test Pro 34', 3000, 300, 200);
update public.profiles set plan_id = (select id from public.plans where name = 'Test Pro 34')
 where id in ('cccccccc-0000-0000-0000-000000000701', 'cccccccc-0000-0000-0000-000000000702');
-- Bayo paid two months ago; this month's renewal failed.
insert into public.subscriptions (owner_id, plan_id, status, amount_ngn, period_end, provider, provider_ref, created_at) values
  ('cccccccc-0000-0000-0000-000000000701', (select id from public.plans where name = 'Test Pro 34'), 'active', 3000, now() + interval '20 days', 'test', 'ref-701', now() - interval '10 days'),
  ('cccccccc-0000-0000-0000-000000000702', (select id from public.plans where name = 'Test Pro 34'), 'active', 3000, now() - interval '20 days', 'test', 'ref-702a', now() - interval '50 days'),
  ('cccccccc-0000-0000-0000-000000000702', (select id from public.plans where name = 'Test Pro 34'), 'past_due', 3000, now() - interval '1 day', 'test', 'ref-702b', now() - interval '1 day');
insert into public.usage_events (owner_id, kind, model, cost_usd) values
  ('cccccccc-0000-0000-0000-000000000701', 'explain', 'test', 0.02),
  ('cccccccc-0000-0000-0000-000000000701', 'draft', 'test', 0.03);

-- Students and reviewers see nothing ---------------------------------------------------------
select test.as_user('cccccccc-0000-0000-0000-000000000701');
select test.refused($$select * from public.admin_users()$$, 'students cannot list people');
select test.refused($$select * from public.admin_overview()$$, 'students cannot read the dashboard counts');
select test.refused($$select * from public.admin_signups_by_day(30)$$, 'students cannot read the sign-ups chart');
select test.refused($$select * from public.admin_user_detail('cccccccc-0000-0000-0000-000000000702')$$, 'students cannot read another person''s details');
select test.refused($$select public.payment_status('cccccccc-0000-0000-0000-000000000702')$$, 'students cannot ask for anyone''s payment status');
select test.check((select count(*) from public.subscriptions) = 1, 'a student sees only their own subscription');
select test.refused($$insert into public.subscriptions (owner_id, plan_id, status) values
  ('cccccccc-0000-0000-0000-000000000701', (select id from public.plans where name = 'Test Pro 34'), 'active')$$, 'a student cannot mark themselves as paid');
select test.refused($$update public.subscriptions set period_end = now() + interval '10 years'$$, 'a student cannot extend their subscription');
reset role;

select test.as_user('dddddddd-0000-0000-0000-000000000704');
select test.refused($$select * from public.admin_users()$$, 'reviewers cannot list people');
select test.refused($$select * from public.admin_overview()$$, 'reviewers cannot read the dashboard counts');
select test.check((select count(*) from public.subscriptions) = 0, 'reviewers cannot see subscriptions');
reset role;

select test.as_anon();
select test.refused($$select * from public.admin_users()$$, 'visitors cannot list people');
select test.refused($$select count(*) from public.subscriptions$$, 'visitors cannot read subscriptions');
reset role;

-- The admin sees the list ------------------------------------------------------------------------
select test.as_user('eeeeeeee-0000-0000-0000-000000000705');
select test.check((select count(*) from public.subscriptions where owner_id::text like 'cccccccc-0000-0000-0000-00000000070%') = 3, 'admins see every subscription');
select test.check((select count(*) from public.admin_users('adminusers')) = 5, 'search finds everyone with the words in their email');
select test.check((select total_count from public.admin_users('adminusers', page_size => 2) limit 1) = 5, 'the total is given even when a page shows fewer');
select test.check((select count(*) from public.admin_users('adminusers', page_size => 2, page_offset => 4)) = 1, 'later pages carry on from earlier ones');
select test.check((select email from public.admin_users('adminusers') limit 1) <> 'chi_100%.adminusers@test.invalid', 'newest people come first');
select test.check((select full_name from public.admin_users('ada.adminusers')) = 'Ada Obi', 'the sign-in name is shown when no name was chosen');
select test.check((select full_name from public.admin_users('bayo.adminusers')) = 'Bayo Ade', 'a chosen name wins over the sign-in name');
select test.check((select count(*) from public.admin_users('Obi')) >= 1, 'search also matches names');
select test.check((select count(*) from public.admin_users('100%')) = 1, 'a % in the search is matched literally');
select test.check((select count(*) from public.admin_users('i_1')) = 1, 'an _ in the search is matched literally');
select test.check((select sign_in_method from public.admin_users('ada.adminusers')) = 'google', 'the sign-in method is shown');
select test.check((select not email_confirmed from public.admin_users('bayo.adminusers')), 'an unconfirmed email is shown as such');
select test.check((select payment_status from public.admin_users('ada.adminusers')) = 'paid', 'an active subscription shows as paid');
select test.check((select paid_until > now() from public.admin_users('ada.adminusers')), 'paid people show when their payment runs out');
select test.check((select payment_status from public.admin_users('bayo.adminusers')) = 'past_due', 'the latest subscription decides: a failed renewal shows as past due');
select test.check((select payment_status from public.admin_users('chi_')) = 'never', 'people who never paid show as never');
select test.check((select plan from public.admin_users('chi_')) = 'Free', 'people with no plan set are on Free');
select test.check((select count(*) from public.admin_users('adminusers', plan_name => 'Test Pro 34')) = 2, 'the plan filter works');
select test.check((select count(*) from public.admin_users('adminusers', payment => 'paid')) = 1, 'the paid filter works');
select test.check((select count(*) from public.admin_users('adminusers', payment => 'unpaid')) = 4, 'the unpaid filter includes past due and never paid');
select test.check((select count(*) from public.admin_users('adminusers', payment => 'past_due')) = 1, 'the past-due filter works');
select test.check((select questions_this_month from public.admin_users('ada.adminusers')) = 2, 'questions this month are counted');
select test.check((select cost_this_month from public.admin_users('ada.adminusers')) = 0.05, 'AI cost this month is added up per person (migration 42)');
select test.check((select cost_this_month from public.admin_users('bayo.adminusers')) = 0, 'people with no use cost nothing');
select test.check((select email from public.admin_users('adminusers', sort => 'cost') limit 1) = 'ada.adminusers@test.invalid', 'sorting by cost puts the highest spender first');
select test.check((select email from public.admin_users('adminusers', sort => 'questions') limit 1) = 'ada.adminusers@test.invalid', 'sorting by questions puts the most questions first');
select test.check((select email from public.admin_users('adminusers', sort => 'active') limit 1) = 'ada.adminusers@test.invalid', 'sorting by activity puts the most recently active first');
select test.check((select last_active_at is not null from public.admin_users('ada.adminusers')), 'the last activity is shown');
-- Bad inputs stop with "invalid value" (22023).
do $$
begin
  begin perform * from public.admin_users(page_size => 1000); raise exception 'FAILED: pages are at most 100 people';
  exception when invalid_parameter_value then raise notice 'ok - pages are at most 100 people'; end;
  begin perform * from public.admin_users(payment => 'free'); raise exception 'FAILED: unknown payment filters are refused';
  exception when invalid_parameter_value then raise notice 'ok - unknown payment filters are refused'; end;
  begin perform * from public.admin_users(sort => 'random'); raise exception 'FAILED: unknown sorts are refused';
  exception when invalid_parameter_value then raise notice 'ok - unknown sorts are refused'; end;
  begin perform * from public.admin_signups_by_day(1000); raise exception 'FAILED: the chart covers at most a year';
  exception when invalid_parameter_value then raise notice 'ok - the chart covers at most a year'; end;
end;
$$;

-- The dashboard counts and the chart ---------------------------------------------------------------
select test.check((select value from public.admin_overview() where metric = 'paying') >= 1, 'the admin sees how many students pay');
select test.check((select value from public.admin_overview() where metric = 'joined_7d') >= 2, 'the admin sees new students this week');
select test.check((select value from public.admin_overview() where metric = 'plan:Test Pro 34') = 2, 'the admin sees students per plan');
select test.check((select count(*) from public.admin_overview() where metric = 'students_total') = 1, 'the total number of students is given');
select test.check((select count(*) from public.admin_signups_by_day(30)) = 30, 'the chart has every day, including days with no sign-ups');
select test.check((select sum(signups) from public.admin_signups_by_day(1)) >= 1, 'today''s sign-ups are counted');

-- One person's details -----------------------------------------------------------------------------
select test.check((select value from public.admin_user_detail('cccccccc-0000-0000-0000-000000000701') where metric = 'email') = 'ada.adminusers@test.invalid', 'the admin sees one person''s email');
select test.check((select value from public.admin_user_detail('cccccccc-0000-0000-0000-000000000701') where metric = 'questions_total') = '2', 'the admin sees one person''s questions');
select test.check((select value from public.admin_user_detail('cccccccc-0000-0000-0000-000000000701') where metric = 'payment_status') = 'paid', 'the admin sees one person''s payment status');
select test.check((select value from public.admin_user_detail('cccccccc-0000-0000-0000-000000000701') where metric = 'joined_at') ~ '^\d{4}-\d{2}-\d{2}T', 'times are given in ISO format');
select test.check((select count(*) from public.admin_user_detail('00000000-0000-0000-0000-000000000000')) = 0, 'an unknown person gives no rows');
select test.refused($$insert into public.subscriptions (owner_id, plan_id, status) values
  ('cccccccc-0000-0000-0000-000000000703', (select id from public.plans where name = 'Test Pro 34'), 'active')$$, 'even admins cannot write payments from the app');
reset role;

-- Leave no paid plan behind for the tests that follow.
delete from public.subscriptions where provider = 'test';
update public.profiles set plan_id = null where plan_id = (select id from public.plans where name = 'Test Pro 34');
delete from public.plans where name = 'Test Pro 34';
