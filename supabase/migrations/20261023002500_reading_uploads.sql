-- Lawdeck migration 25: reading students' uploads (Phase 6, step 6b). PRD UP-01 and UP-04;
-- System Design §2.4. Founder's decision (2026-10-23): at most 200 scanned pages per student per
-- month on the Free plan; text pages are unlimited and nothing here counts as a question.
-- 1. upload_pages: the text of each page while a long file is read in several steps. Owner only.
-- 2. uploads.problem: why a file could not be read, in plain words.
-- 3. replace_upload_passages(): saves a file's passages in one go; finish_upload_reading()
--    marks it Ready only if it really has passages; fail_upload_reading() records a failure.
--    A student still cannot set a file's status directly.
-- 4. Search vectors: the owner's own passages may be given their vectors.
-- 5. The scanned-page allowance: a ledger the student cannot change, and the plan's limit.

-- ---------------------------------------------------------------------------
-- 1. Page text, owner only, gone with the upload.
create table public.upload_pages (
  upload_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  text text not null check (char_length(text) <= 100000),
  method public.reading_method not null check (method in ('text', 'scan')),
  created_at timestamptz not null default now(),
  primary key (upload_id, page),
  foreign key (upload_id, owner_id) references public.uploads (id, owner_id) on delete cascade
);
alter table public.upload_pages enable row level security;
revoke all on public.upload_pages from anon, authenticated;
grant select, delete on public.upload_pages to authenticated;
grant insert (upload_id, page, text, method) on public.upload_pages to authenticated;
create policy "Owners read their page text" on public.upload_pages
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners add page text" on public.upload_pages
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners remove page text" on public.upload_pages
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Why a file could not be read.
alter table public.uploads add column problem text check (char_length(problem) <= 500);

-- ---------------------------------------------------------------------------
-- 3. Reading results. Security definer so they can change the status, which students cannot
-- write directly; each checks that the file is the caller's own first.
create function public.own_upload(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.uploads u where u.id = target and u.owner_id = (select auth.uid()));
$$;
revoke all on function public.own_upload(uuid) from public, anon;
grant execute on function public.own_upload(uuid) to authenticated;

-- Starting (again): forget earlier page text and passages, mark the file as being read.
create function public.restart_upload_reading(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.own_upload(target) then
    raise exception 'That file could not be found.' using errcode = '42501';
  end if;
  delete from public.upload_pages where upload_id = target;
  delete from public.upload_passages where upload_id = target;
  update public.uploads set status = 'processing', page_count = null, ocr_confidence = null, problem = null
   where id = target;
end;
$$;

create function public.set_upload_page_count(target uuid, pages integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.own_upload(target) then
    raise exception 'That file could not be found.' using errcode = '42501';
  end if;
  update public.uploads set page_count = greatest(0, least(pages, 5000)) where id = target;
end;
$$;

-- Replaces a file's passages in one go (all or nothing). The file stays "processing" until it is
-- indexed and finished.
create function public.replace_upload_passages(target uuid, passages jsonb, quality numeric, pages integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  added integer;
begin
  if not public.own_upload(target) then
    raise exception 'That file could not be found.' using errcode = '42501';
  end if;
  if jsonb_typeof(passages) is distinct from 'array' or jsonb_array_length(passages) > 5000 then
    raise exception 'Passages must be a list of at most 5000.' using errcode = '22023';
  end if;
  delete from public.upload_passages where upload_id = target;
  insert into public.upload_passages (upload_id, owner_id, position, heading, text, page_from, page_to)
  select target, me,
         (p.ordinality - 1)::integer,
         nullif(p.value ->> 'heading', ''),
         p.value ->> 'text',
         (p.value ->> 'pageFrom')::integer,
         (p.value ->> 'pageTo')::integer
  from jsonb_array_elements(passages) with ordinality as p;
  get diagnostics added = row_count;
  update public.uploads
     set ocr_confidence = greatest(0, least(quality, 1)), page_count = greatest(0, least(pages, 5000))
   where id = target;
  return added;
end;
$$;

-- Ready only when the file really has passages.
create function public.finish_upload_reading(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.own_upload(target) then
    raise exception 'That file could not be found.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.upload_passages where upload_id = target) then
    raise exception 'This file has no passages yet.' using errcode = '23514';
  end if;
  update public.uploads set status = 'ready', problem = null where id = target;
end;
$$;

create function public.fail_upload_reading(target uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.own_upload(target) then
    raise exception 'That file could not be found.' using errcode = '42501';
  end if;
  update public.uploads set status = 'failed', problem = left(coalesce(reason, 'The file could not be read.'), 500)
   where id = target;
end;
$$;

revoke all on function public.restart_upload_reading(uuid), public.set_upload_page_count(uuid, integer),
  public.replace_upload_passages(uuid, jsonb, numeric, integer), public.finish_upload_reading(uuid),
  public.fail_upload_reading(uuid, text) from public, anon;
grant execute on function public.restart_upload_reading(uuid), public.set_upload_page_count(uuid, integer),
  public.replace_upload_passages(uuid, jsonb, numeric, integer), public.finish_upload_reading(uuid),
  public.fail_upload_reading(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Search vectors for the owner's own passages.
grant update (embedding, embedding_model) on public.upload_passages to authenticated;
create policy "Owners index their passages" on public.upload_passages
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Scanned pages: the plan's monthly limit (Free: 200; none set means unlimited) and a ledger
-- of pages read, which students can read but never change or delete (deleting a file does not
-- give its pages back).
alter table public.plans add column monthly_scan_page_limit integer check (monthly_scan_page_limit >= 0);
update public.plans set monthly_scan_page_limit = 200 where name = 'Free';

create table public.scan_page_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  pages integer not null check (pages between 1 and 100),
  created_at timestamptz not null default now()
);
alter table public.scan_page_usage enable row level security;
create index scan_page_usage_owner_idx on public.scan_page_usage (owner_id, created_at);
revoke all on public.scan_page_usage from anon, authenticated;
grant select on public.scan_page_usage to authenticated;
create policy "Owners read their scan usage" on public.scan_page_usage
  for select to authenticated using (owner_id = (select auth.uid()));

-- Scanned pages the signed-in student may still have read this month (WAT), or null if unlimited.
create function public.scan_pages_left()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  page_limit integer;
  used integer;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if public.is_reviewer() then
    return null;
  end if;
  select coalesce(p.monthly_scan_page_limit, free.monthly_scan_page_limit) into page_limit
    from public.profiles pr
    left join public.plans p on p.id = pr.plan_id
    cross join (select monthly_scan_page_limit from public.plans where name = 'Free') free
   where pr.id = me;
  if page_limit is null then
    return null;
  end if;
  select coalesce(sum(s.pages), 0)::integer into used
    from public.scan_page_usage s where s.owner_id = me and s.created_at >= month_start;
  return greatest(page_limit - used, 0);
end;
$$;

-- Records scanned pages read for the signed-in student.
create function public.record_scan_pages(pages integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if pages is null or pages < 1 or pages > 100 then
    raise exception 'Pages must be between 1 and 100.' using errcode = '22023';
  end if;
  insert into public.scan_page_usage (owner_id, pages) values ((select auth.uid()), pages);
end;
$$;
revoke all on function public.scan_pages_left(), public.record_scan_pages(integer) from public, anon;
grant execute on function public.scan_pages_left(), public.record_scan_pages(integer) to authenticated;
