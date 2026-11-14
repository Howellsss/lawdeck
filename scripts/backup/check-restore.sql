-- Checks a restored backup without printing any data: only PASS or FAIL lines.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
select case when count(*) >= 60 then 'PASS' else 'FAIL' end || ' tables restored in the Lawdeck schema'
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';
select case when bool_and(c.relrowsecurity) then 'PASS' else 'FAIL' end || ' row-level security is on for every Lawdeck table'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';
select case when exists (select 1 from auth.users) then 'PASS' else 'FAIL' end || ' sign-in accounts restored';
select case when (select count(*) from auth.users) = (select count(*) from public.profiles) then 'PASS' else 'FAIL' end
  || ' every account has its profile';
select case when exists (select 1 from public.courses) then 'PASS' else 'FAIL' end || ' courses restored';
select case when exists (select 1 from pg_policies where schemaname = 'public') then 'PASS' else 'FAIL' end || ' access rules (policies) restored';
select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_admin')
  then 'PASS' else 'FAIL' end || ' database functions restored';
