-- Lawdeck migration 24: students' private uploads (Phase 6, step 6a). PRD UP-01 to UP-06;
-- System Design §2.4, §3 (uploads, upload_passages) and §4.3; Engineering Rules E-03 and F-02.
-- 1. The upload notice (PRD Appendix C): accepted once, recorded by the database.
-- 2. The "uploads" file store: private; each student can only reach the folder named with their
--    own id. Reviewers and admins cannot see students' files.
-- 3. uploads and upload_passages: each file's details and (from step 6b) its searchable
--    passages. Owner only, and never part of the shared library (UP-03).
-- 4. Limits: no upload before the notice is accepted; at most the plan's number of files
--    (Free: 50).

-- ---------------------------------------------------------------------------
-- 1. The upload notice.
alter table public.profiles add column upload_notice_accepted_at timestamptz;

-- Records that the signed-in student accepted the notice (once; the first time stays).
create function public.accept_upload_notice()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  accepted timestamptz;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  update public.profiles
     set upload_notice_accepted_at = coalesce(upload_notice_accepted_at, now())
   where id = me
  returning upload_notice_accepted_at into accepted;
  return accepted;
end;
$$;
revoke all on function public.accept_upload_notice() from public, anon;
grant execute on function public.accept_upload_notice() to authenticated;

-- Has the signed-in student accepted the notice? Used by the rules below.
create function public.upload_notice_accepted()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.upload_notice_accepted_at is not null
  );
$$;
revoke all on function public.upload_notice_accepted() from public, anon;
grant execute on function public.upload_notice_accepted() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The private file store. Same file types and size as the library (rule F-02).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads',
  'uploads',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do nothing;

-- Only inside the folder named with the student's own id. Files are never replaced in place.
create policy "Students read their own uploads" on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "Students add to their own uploads folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and public.upload_notice_accepted()
  );

create policy "Students remove their own uploads" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and split_part(name, '/', 1) = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 3. Uploads and their passages.
create type public.upload_status as enum ('processing', 'ready', 'failed');

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  )),
  size_bytes integer not null check (size_bytes between 1 and 26214400),
  -- Always inside the owner's own folder: "<owner id>/<file id>.<kind>".
  storage_path text not null unique check (char_length(storage_path) <= 200),
  status public.upload_status not null default 'processing',
  -- Extraction quality, 0 to 1 (step 6b); low values are flagged to the student (UP-04).
  ocr_confidence numeric(4, 3) check (ocr_confidence between 0 and 1),
  page_count integer check (page_count between 0 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  check (split_part(storage_path, '/', 1) = owner_id::text),
  -- An upload can only join its owner's own project.
  foreign key (project_id, owner_id) references public.projects (id, owner_id) on delete set null (project_id)
);
alter table public.uploads enable row level security;
create index uploads_owner_idx on public.uploads (owner_id, created_at desc);
create trigger uploads_set_updated_at
  before update on public.uploads
  for each row execute function public.set_updated_at();

create table public.upload_passages (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null check (position >= 0),
  heading text check (char_length(heading) <= 500),
  text text not null check (char_length(text) between 1 and 20000),
  page_from integer check (page_from >= 1),
  page_to integer check (page_to >= page_from),
  embedding extensions.vector(1024),
  embedding_model text check (char_length(embedding_model) <= 80),
  search_text tsvector generated always as
    (to_tsvector('english'::regconfig, coalesce(heading, '') || ' ' || text)) stored,
  created_at timestamptz not null default now(),
  unique (upload_id, position),
  -- A passage can only belong to the student's own upload; it goes when the upload goes.
  foreign key (upload_id, owner_id) references public.uploads (id, owner_id) on delete cascade
);
alter table public.upload_passages enable row level security;
create index upload_passages_owner_idx on public.upload_passages (owner_id);
create index upload_passages_search_text_idx on public.upload_passages using gin (search_text);
create index upload_passages_embedding_idx on public.upload_passages
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- 4. Limits, checked by the database whatever the app does: the notice first, then at most the
-- plan's number of files (no limit set means unlimited).
create function public.uploads_check_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  file_limit integer;
begin
  if not public.upload_notice_accepted() then
    raise exception 'Accept the upload notice first.' using errcode = '42501';
  end if;
  select coalesce(p.upload_limit, free.upload_limit) into file_limit
    from public.profiles pr
    left join public.plans p on p.id = pr.plan_id
    cross join (select upload_limit from public.plans where name = 'Free') free
   where pr.id = new.owner_id;
  if file_limit is not null
     and (select count(*) from public.uploads u where u.owner_id = new.owner_id) >= file_limit then
    raise exception 'You have reached your plan''s limit of % files. Delete a file to add another.', file_limit
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger uploads_check_limits
  before insert on public.uploads
  for each row execute function public.uploads_check_limits();

-- ---------------------------------------------------------------------------
-- Who may do what. Owners only; reviewers, admins and visitors get nothing.
revoke all on public.uploads, public.upload_passages from anon, authenticated;

grant select, delete on public.uploads to authenticated;
grant insert (project_id, file_name, mime_type, size_bytes, storage_path) on public.uploads to authenticated;
create policy "Owners read their uploads" on public.uploads
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners add uploads" on public.uploads
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners delete their uploads" on public.uploads
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Passages are written while a file is read (step 6b) and go with their upload.
grant select, delete on public.upload_passages to authenticated;
grant insert (upload_id, position, heading, text, page_from, page_to, embedding, embedding_model)
  on public.upload_passages to authenticated;
create policy "Owners read their upload passages" on public.upload_passages
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners add upload passages" on public.upload_passages
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners delete their upload passages" on public.upload_passages
  for delete to authenticated using (owner_id = (select auth.uid()));
