-- Lawdeck migration 6: reading library files into passages (Phase 2, step 2c).
-- System Design §2.5 and §6: text is extracted (OCR for scans), split into passages with
-- headings and page numbers, and the extraction quality is recorded.

create type public.reading_status as enum ('waiting', 'reading', 'done', 'failed');
create type public.reading_method as enum ('text', 'scan', 'mixed');

-- How far reading has got for each item. Only admins (and marked admin jobs) change these.
alter table public.kb_items
  add column reading_status public.reading_status not null default 'waiting',
  add column reading_method public.reading_method,
  -- Share of pages with readable text, 0 to 1 (extraction quality).
  add column reading_quality numeric(4, 3) check (reading_quality between 0 and 1),
  add column page_count integer check (page_count between 0 and 5000),
  add column read_at timestamptz,
  -- A plain message for the admin; never document text.
  add column reading_error text check (char_length(reading_error) <= 300);

-- Reviewers may still change only the review fields; the reading fields are added to the guard.
create or replace function public.kb_items_review_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- auth.uid() is empty only for marked admin jobs (service key), which may change anything.
  if (select auth.uid()) is not null and not public.is_admin() then
    if (new.title, new.type, new.course_id, new.topic_ids, new.campus, new.year, new.source,
        new.storage_path, new.file_name, new.mime_type, new.size_bytes, new.created_by,
        new.reading_status, new.reading_method, new.reading_quality, new.page_count, new.read_at,
        new.reading_error)
       is distinct from
       (old.title, old.type, old.course_id, old.topic_ids, old.campus, old.year, old.source,
        old.storage_path, old.file_name, old.mime_type, old.size_bytes, old.created_by,
        old.reading_status, old.reading_method, old.reading_quality, old.page_count, old.read_at,
        old.reading_error) then
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

-- ---------------------------------------------------------------------------
-- kb_item_pages: the text read from each page of a PDF or image, kept while a long scan is
-- read in several steps, and afterwards so reviewers can compare passages with the page.
create table public.kb_item_pages (
  item_id uuid not null references public.kb_items (id) on delete cascade,
  page integer not null check (page between 1 and 5000),
  text text not null check (char_length(text) <= 100000),
  method public.reading_method not null check (method in ('text', 'scan')),
  created_at timestamptz not null default now(),
  primary key (item_id, page)
);
alter table public.kb_item_pages enable row level security;

-- Same rule as passages: no student access; reviewers read; admins add and remove.
revoke all on public.kb_item_pages from anon, authenticated;
grant select, insert, delete on public.kb_item_pages to authenticated;
create policy "Reviewers read page text" on public.kb_item_pages
  for select to authenticated using (public.is_reviewer());
create policy "Admins add page text" on public.kb_item_pages
  for insert to authenticated with check (public.is_admin());
create policy "Admins remove page text" on public.kb_item_pages
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Replaces an item's passages in one go (all or nothing) and marks it as read.
-- Runs with the caller's own permissions, so row-level security still applies; the admin
-- check is repeated here so a refusal is clear.
create function public.replace_kb_passages(
  target_item uuid,
  passages jsonb,
  method public.reading_method,
  quality numeric,
  pages integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  added integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can replace passages.' using errcode = '42501';
  end if;
  if jsonb_typeof(passages) is distinct from 'array' or jsonb_array_length(passages) > 5000 then
    raise exception 'Passages must be a list of at most 5000.' using errcode = '22023';
  end if;

  delete from public.kb_passages where item_id = target_item;
  insert into public.kb_passages (item_id, position, heading, text, page_from, page_to)
  select target_item,
         (p.ordinality - 1)::integer,
         nullif(p.value ->> 'heading', ''),
         p.value ->> 'text',
         (p.value ->> 'pageFrom')::integer,
         (p.value ->> 'pageTo')::integer
  from jsonb_array_elements(passages) with ordinality as p;
  get diagnostics added = row_count;

  update public.kb_items
     set reading_status = 'done', reading_method = method, reading_quality = quality,
         page_count = pages, read_at = now(), reading_error = null
   where id = target_item;
  if not found then
    raise exception 'That item no longer exists.' using errcode = 'P0002';
  end if;
  return added;
end;
$$;

revoke execute on function public.replace_kb_passages(uuid, jsonb, public.reading_method, numeric, integer)
  from public, anon;
grant execute on function public.replace_kb_passages(uuid, jsonb, public.reading_method, numeric, integer)
  to authenticated;
