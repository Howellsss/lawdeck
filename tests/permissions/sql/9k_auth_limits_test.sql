-- Permission tests at database level: sign-in, sign-up and reset limits (migration 29).
\set ON_ERROR_STOP on
\set QUIET on

create table test.hashes as select repeat('a', 64) as email_a, repeat('b', 64) as email_b, repeat('c', 64) as ip_1, repeat('d', 64) as ip_2;
grant select on test.hashes to anon, authenticated;

-- Wrong passwords ------------------------------------------------------------------------------------
select test.as_anon();
select test.check((select public.auth_wait_seconds('sign_in', email_a, ip_1) from test.hashes) = 0, 'a first sign-in goes ahead');
select public.record_auth_attempt('sign_in_failed', email_a, ip_1) from test.hashes, generate_series(1, 4);
select test.check((select public.auth_wait_seconds('sign_in', email_a, ip_1) from test.hashes) = 0, 'four wrong passwords: still allowed');
select public.record_auth_attempt('sign_in_failed', email_a, ip_1) from test.hashes;
select test.check((select public.auth_wait_seconds('sign_in', email_a, ip_2) from test.hashes) between 800 and 900,
  'five wrong passwords pause that email for about 15 minutes, from any address');
select test.check((select public.auth_wait_seconds('sign_in', email_b, ip_1) from test.hashes) = 0, 'other emails are not paused');
reset role;
update public.auth_attempts set created_at = created_at - interval '16 minutes' where kind = 'sign_in_failed';
select test.as_anon();
select test.check((select public.auth_wait_seconds('sign_in', email_a, ip_1) from test.hashes) = 0, 'the pause ends after 15 minutes');

-- Sign-up, reset and resend -------------------------------------------------------------------------------
select public.record_auth_attempt('reset', email_a, ip_1) from test.hashes, generate_series(1, 5);
select test.check((select public.auth_wait_seconds('reset', email_a, ip_2) from test.hashes) > 3000, 'five resets an hour for one email, then a wait');
select test.check((select public.auth_wait_seconds('sign_up', email_a, ip_1) from test.hashes) = 0, 'each kind is counted separately');
select public.record_auth_attempt('sign_up', md5(i::text) || md5(i::text), ip_2) from test.hashes, generate_series(1, 20) i;
select test.check((select public.auth_wait_seconds('sign_up', email_b, ip_2) from test.hashes) > 3000,
  'twenty sign-ups an hour from one address, then a wait');
select test.check((select public.auth_wait_seconds('sign_up', email_b, ip_1) from test.hashes) = 0, 'other addresses are not affected');

-- Nobody reads or writes the attempts directly --------------------------------------------------------------
select test.refused($$select * from public.auth_attempts$$, 'visitors cannot read attempts');
select test.refused($$delete from public.auth_attempts$$, 'visitors cannot clear attempts');
reset role;
insert into auth.users (id, email) values ('cccccccc-0000-0000-0000-000000000291', 'student291@test.invalid');
select test.as_user('cccccccc-0000-0000-0000-000000000291');
select test.refused($$select * from public.auth_attempts$$, 'students cannot read attempts');
do $$
begin
  perform public.record_auth_attempt('sign_in_failed', 'not-a-hash', repeat('c', 64));
  raise exception 'FAILED: a real email was stored';
exception when check_violation then
  raise notice 'ok - only scrambled emails can be stored (refused)';
end $$;
reset role;
select test.check((select count(*) from public.auth_attempts where email_hash !~ '^[0-9a-f]{64}$') = 0, 'only scrambled values are kept');
