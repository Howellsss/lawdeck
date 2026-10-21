-- Lawdeck migration 4: the library (knowledge base) and reviewer/admin roles.
-- System Design §3 (kb_items, kb_passages) and §4 (permissions).
-- Students never read library passages directly: answers use them on the server (Phase 3),
-- through a search function that returns a few approved passages at a time (step 2d).

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Role checks used by the rules below. They read only the caller's own role.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role in ('reviewer', 'admin')
  );
$$;

revoke execute on function public.is_admin(), public.is_reviewer() from public, anon;
grant execute on function public.is_admin(), public.is_reviewer() to authenticated;

-- ---------------------------------------------------------------------------
create type public.kb_item_type as enum
  ('course_material', 'note', 'draft', 'textbook', 'statute', 'rule_of_court', 'case');
create type public.review_status as enum ('pending', 'approved', 'rejected', 'withdrawn');

-- kb_items: one row per source file.
create table public.kb_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  type public.kb_item_type not null,
  course_id uuid not null references public.courses (id),
  topic_ids uuid[] not null default '{}',
  campus text check (char_length(campus) <= 80),
  year integer check (year between 1960 and 2100),
  source text check (char_length(source) <= 500),
  -- The original file in the private "library" bucket. Never downloadable by students.
  storage_path text check (char_length(storage_path) <= 500),
  file_name text check (char_length(file_name) <= 255),
  mime_type text check (char_length(mime_type) <= 120),
  size_bytes bigint check (size_bytes between 0 and 26214400),
  review_status public.review_status not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (char_length(review_note) <= 2000),
  -- The date the reviewer confirmed the material reflects the law (currency check, KB-02).
  law_current_as_of date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kb_items enable row level security;
create index kb_items_course_status_idx on public.kb_items (course_id, review_status);
create trigger kb_items_set_updated_at
  before update on public.kb_items
  for each row execute function public.set_updated_at();

-- Reviewers may change only the review fields; the reviewer and time are recorded automatically.
create function public.kb_items_review_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- auth.uid() is empty only for marked admin jobs (service key), which may change anything.
  if (select auth.uid()) is not null and not public.is_admin() then
    if (new.title, new.type, new.course_id, new.topic_ids, new.campus, new.year, new.source,
        new.storage_path, new.file_name, new.mime_type, new.size_bytes, new.created_by)
       is distinct from
       (old.title, old.type, old.course_id, old.topic_ids, old.campus, old.year, old.source,
        old.storage_path, old.file_name, old.mime_type, old.size_bytes, old.created_by) then
      raise exception 'Reviewers can only change review details.' using errcode = '42501';
    end if;
  end if;
  if new.review_status is distinct from old.review_status then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger kb_items_review_guard
  before update on public.kb_items
  for each row execute function public.kb_items_review_guard();

-- ---------------------------------------------------------------------------
-- kb_passages: the searchable pieces of each item (about 300–800 words each).
create table public.kb_passages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.kb_items (id) on delete cascade,
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
  updated_at timestamptz not null default now(),
  unique (item_id, position)
);
alter table public.kb_passages enable row level security;
create index kb_passages_search_text_idx on public.kb_passages using gin (search_text);
create index kb_passages_embedding_idx on public.kb_passages
  using hnsw (embedding extensions.vector_cosine_ops);
create trigger kb_passages_set_updated_at
  before update on public.kb_passages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Who may do what. Visitors get nothing.
revoke all on public.kb_items, public.kb_passages from anon, authenticated;

-- Items: students see approved items' details (for the Sources panel); reviewers and admins
-- see everything. Reviewers change review details; only admins add or remove items.
grant select, insert, update, delete on public.kb_items to authenticated;
create policy "Students see approved items; reviewers see all" on public.kb_items
  for select to authenticated
  using (review_status = 'approved' or public.is_reviewer());
create policy "Admins add items" on public.kb_items
  for insert to authenticated with check (public.is_admin());
create policy "Reviewers review items" on public.kb_items
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Admins remove items" on public.kb_items
  for delete to authenticated using (public.is_admin());

-- Passages: no direct student access at all. Reviewers read and correct the wording;
-- admins add and remove. Search vectors are written only by the marked admin job.
grant select, insert, delete on public.kb_passages to authenticated;
grant update (heading, text) on public.kb_passages to authenticated;
create policy "Reviewers read passages" on public.kb_passages
  for select to authenticated using (public.is_reviewer());
create policy "Admins add passages" on public.kb_passages
  for insert to authenticated with check (public.is_admin());
create policy "Reviewers correct passages" on public.kb_passages
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Admins remove passages" on public.kb_passages
  for delete to authenticated using (public.is_admin());
