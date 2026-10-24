-- A tiny stand-in for the parts of Supabase the migrations rely on, so the
-- row-level security rules can be tested on a plain local PostgreSQL.
-- Never run this on the real Supabase project.
-- Roles belong to the whole server, so only create them once.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
-- The columns of Supabase's sign-in table that the migrations read (the admin Users page, migration 34).
create table auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb not null default '{}',
  raw_user_meta_data jsonb not null default '{}'
);

-- Same idea as Supabase's auth.uid(): the signed-in user's id from the request.
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase gives these roles broad table rights by default; the migrations must take them away.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Supabase keeps extensions such as pgvector in their own schema.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- A minimal copy of Supabase Storage's tables, so the file rules can be tested.
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
