-- Prepares an empty, throwaway PostgreSQL to receive a Lawdeck backup (practice restore, step 7d).
-- Creates the Supabase roles and extensions a backup refers to. Never run on Supabase itself.
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role','authenticator','supabase_admin',
    'supabase_auth_admin','supabase_storage_admin','dashboard_user','pgbouncer','supabase_realtime_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if;
  end loop;
end $$;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
