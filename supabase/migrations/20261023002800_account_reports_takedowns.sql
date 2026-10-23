-- Lawdeck migration 28: delete account, report a problem, takedown requests (Phase 6, step 6f).
-- PRD AC-05, FB-01, FB-03. Approved by the founder, 2026-10-23.
-- 1. delete_my_account(): a student deletes their own account and, with it, all their data
--    (every student-owned table is removed with the account). Their files must be removed first.
-- 2. problem_reports: "Report a problem" on an answer, document, brief or practice question.
--    Students see their own reports; reviewers see all, with what was reported, and resolve them.
-- 3. takedown_requests: anyone (signed in or not) can ask for material to be removed. Only
--    reviewers can read the requests (they hold names and emails); the team acts within 7 days.

-- ---------------------------------------------------------------------------
-- 1. Deleting an account.
create function public.delete_my_account(confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in to delete your account.' using errcode = '42501';
  end if;
  if confirm is distinct from 'DELETE' then
    raise exception 'Type DELETE to confirm.' using errcode = '22023';
  end if;
  -- Staff accounts are removed by the founder, so the review team is never locked out by mistake.
  if exists (select 1 from public.profiles where id = me and role in ('reviewer', 'admin')) then
    raise exception 'Reviewer and admin accounts are removed by the founder.' using errcode = '42501';
  end if;
  -- The student's uploaded files are removed first (through the file store); none may be left.
  if exists (select 1 from storage.objects where bucket_id = 'uploads' and split_part(name, '/', 1) = me::text) then
    raise exception 'Some of your files are still stored. Please try again.' using errcode = '55000';
  end if;
  -- Everything the student owns is deleted with the account; reviewed items keep their content and
  -- lose only the reviewer's name.
  delete from auth.users where id = me;
end;
$$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Problem reports.
create table public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('answer', 'document', 'brief', 'practice_item')),
  target_id uuid not null,
  category text not null check (category in ('wrong_law', 'outdated', 'unclear', 'formatting', 'other')),
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.problem_reports enable row level security;
create index problem_reports_status_idx on public.problem_reports (status, created_at desc);
create index problem_reports_owner_idx on public.problem_reports (owner_id, created_at desc);

revoke all on public.problem_reports from anon, authenticated;
grant select on public.problem_reports to authenticated;
grant insert (target_kind, target_id, category, note) on public.problem_reports to authenticated;
grant update (status) on public.problem_reports to authenticated;
create policy "Students read their own reports; reviewers read all" on public.problem_reports
  for select to authenticated using (owner_id = (select auth.uid()) or public.is_reviewer());
create policy "Students report their own work" on public.problem_reports
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Reviewers resolve reports" on public.problem_reports
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());

-- A report must point at the student's own answer, document, brief or practice question, and a
-- student can file at most 50 reports a day. Runs with the student's rights, so row-level security
-- decides what "their own" is.
create function public.problem_reports_check_target()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  found boolean := false;
begin
  if (select count(*) from public.problem_reports
       where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 50 then
    raise exception 'You have sent a lot of reports today. Please try again tomorrow.' using errcode = '23514';
  end if;
  if new.target_kind = 'answer' then
    found := exists (select 1 from public.messages m where m.id = new.target_id and m.owner_id = new.owner_id and m.role = 'assistant');
  elsif new.target_kind = 'document' then
    found := exists (select 1 from public.documents d where d.id = new.target_id and d.owner_id = new.owner_id);
  elsif new.target_kind = 'brief' then
    found := exists (select 1 from public.briefs b where b.id = new.target_id and b.owner_id = new.owner_id);
  elsif new.target_kind = 'practice_item' then
    found := exists (select 1 from public.practice_items p where p.id = new.target_id and p.owner_id = new.owner_id);
  end if;
  if not found then
    raise exception 'That could not be found.' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger problem_reports_check_target
  before insert on public.problem_reports
  for each row execute function public.problem_reports_check_target();

-- Who resolved a report, and when, is recorded by the database.
create function public.problem_reports_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_by := (select auth.uid());
    new.resolved_at := now();
  elsif new.status = 'open' then
    new.resolved_by := null;
    new.resolved_at := null;
  end if;
  return new;
end;
$$;
create trigger problem_reports_stamp
  before update on public.problem_reports
  for each row execute function public.problem_reports_stamp();

-- What was reported, for reviewers only: a title and the reported text (cut at 4,000 characters).
-- Reporting is the student's choice to show it to the review team.
create function public.problem_report_context(report uuid)
returns table (title text, body text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.problem_reports;
begin
  if not public.is_reviewer() then
    return;
  end if;
  select * into r from public.problem_reports where id = report;
  if r.id is null then
    return;
  end if;
  return query
  select x.title, left(x.body, 4000)
  from (
    select c.title, coalesce(m.content ->> 'text', '') as body
      from public.messages m join public.conversations c on c.id = m.conversation_id
     where r.target_kind = 'answer' and m.id = r.target_id
    union all
    select d.title, coalesce(t.title, '') from public.documents d left join public.templates t on t.id = d.template_id
     where r.target_kind = 'document' and d.id = r.target_id
    union all
    select b.name, b.sections::text from public.briefs b
     where r.target_kind = 'brief' and b.id = r.target_id
    union all
    select p.question, p.answer from public.practice_items p
     where r.target_kind = 'practice_item' and p.id = r.target_id
  ) x
  limit 1;
end;
$$;
revoke all on function public.problem_report_context(uuid) from public, anon;
grant execute on function public.problem_report_context(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Takedown requests.
create table public.takedown_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  material text not null check (char_length(btrim(material)) between 1 and 2000),
  reason text not null check (char_length(btrim(reason)) between 1 and 4000),
  status text not null default 'open' check (status in ('open', 'done')),
  done_by uuid references auth.users (id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.takedown_requests enable row level security;
create index takedown_requests_status_idx on public.takedown_requests (status, created_at);

revoke all on public.takedown_requests from anon, authenticated;
grant select, update (status) on public.takedown_requests to authenticated;
create policy "Reviewers read takedown requests" on public.takedown_requests
  for select to authenticated using (public.is_reviewer());
create policy "Reviewers close takedown requests" on public.takedown_requests
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());

create function public.takedown_requests_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    new.done_by := (select auth.uid());
    new.done_at := now();
  elsif new.status = 'open' then
    new.done_by := null;
    new.done_at := null;
  end if;
  return new;
end;
$$;
create trigger takedown_requests_stamp
  before update on public.takedown_requests
  for each row execute function public.takedown_requests_stamp();

-- The only way in: checked, length-limited, and at most 30 requests an hour from everyone together
-- (against floods). Returns nothing that could reveal other requests.
create function public.submit_takedown(name text, email text, material text, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.takedown_requests where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many requests just now. Please try again in an hour.' using errcode = '55000';
  end if;
  insert into public.takedown_requests (name, email, material, reason)
  values (btrim(name), lower(btrim(email)), btrim(material), btrim(reason));
end;
$$;
revoke all on function public.submit_takedown(text, text, text, text) from public;
grant execute on function public.submit_takedown(text, text, text, text) to anon, authenticated;
