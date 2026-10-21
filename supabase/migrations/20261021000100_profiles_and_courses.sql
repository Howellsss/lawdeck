-- Lawdeck migration 1 of 3: student profiles, plans, courses and topics.
-- System Design §3 and §4. Row-level security is switched on for every table here.
-- Paste into the Supabase SQL Editor once. It is safe to read; it changes nothing that exists.

-- Roles a person can have in Lawdeck.
create type public.app_role as enum ('student', 'reviewer', 'admin');

-- Keeps updated_at current on every change.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- plans: plan names and limits (prices are still an open decision).
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  price_ngn integer check (price_ngn >= 0),
  monthly_message_limit integer check (monthly_message_limit >= 0),
  upload_limit integer check (upload_limit >= 0),
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: one row per person, created automatically at sign-up.
-- The id is the sign-in account id, so it plays the role of owner_id.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  campus text check (char_length(campus) <= 80),
  role public.app_role not null default 'student',
  plan_id uuid references public.plans (id),
  courses uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates the profile when someone signs up. Runs with owner rights because
-- students cannot insert profiles themselves.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for people who signed up before this migration.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- courses and topics: curriculum structure only, never legal content (rule H-01).
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,60}$'),
  name text not null check (char_length(name) between 1 and 120),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.courses enable row level security;

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{1,80}$'),
  name text not null check (char_length(name) between 1 and 160),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (course_id, slug)
);
alter table public.topics enable row level security;
create index topics_course_id_idx on public.topics (course_id);

insert into public.courses (slug, name, position) values
  ('civil-litigation', 'Civil Litigation', 1),
  ('criminal-litigation', 'Criminal Litigation', 2),
  ('property-law-practice', 'Property Law Practice', 3),
  ('corporate-law-practice', 'Corporate Law Practice', 4),
  ('law-in-practice', 'Law in Practice', 5);

-- ---------------------------------------------------------------------------
-- Who may do what. Visitors who are not signed in (anon) get nothing.
revoke all on public.plans, public.profiles, public.courses, public.topics from anon, authenticated;

-- Plans, courses and topics: signed-in people can read; nobody changes them from the app.
grant select on public.plans, public.courses, public.topics to authenticated;
create policy "Signed-in users can read plans" on public.plans
  for select to authenticated using (true);
create policy "Signed-in users can read courses" on public.courses
  for select to authenticated using (true);
create policy "Signed-in users can read topics" on public.topics
  for select to authenticated using (true);

-- Profiles: each person reads and edits only their own, and only these columns.
-- Role and plan cannot be changed by the student (System Design §4).
grant select on public.profiles to authenticated;
grant update (full_name, campus, courses) on public.profiles to authenticated;
create policy "People can read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "People can update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
