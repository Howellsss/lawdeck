-- Lawdeck migration 71: no duplicate files in the library (founder, 2026-11-24: "duplicates can not
-- be added again, only the files that haven't been added").
-- 1. Each library item remembers the Google Drive file it came from (drive_file_id) and a
--    fingerprint of its contents (content_sha256), so the Drive import can skip files already in
--    the library before downloading them, and skip the same file under another name after.
-- 2. Items already read have their fingerprint in their archive path (migration 11); it is copied
--    across now. Others get one the next time they are read.
-- 3. Both are set once: nobody can change them afterwards (as the archive path).
-- Needs migrations 1–70.

alter table public.kb_items
  add column drive_file_id text check (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  add column content_sha256 text check (content_sha256 ~ '^[0-9a-f]{64}$');

update public.kb_items
   set content_sha256 = substring(archive_path from '([0-9a-f]{64})\.[a-z]+$')
 where archive_path is not null and content_sha256 is null;

create index kb_items_drive_file_id_idx on public.kb_items (drive_file_id) where drive_file_id is not null;
create index kb_items_content_sha256_idx on public.kb_items (content_sha256) where content_sha256 is not null;
create index kb_items_file_name_size_idx on public.kb_items (file_name, size_bytes);

create function public.kb_items_origin_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.drive_file_id is distinct from old.drive_file_id and old.drive_file_id is not null)
     or (new.content_sha256 is distinct from old.content_sha256 and old.content_sha256 is not null) then
    raise exception 'Where a library file came from, and its fingerprint, cannot be changed.' using errcode = '23514';
  end if;
  if (new.drive_file_id is distinct from old.drive_file_id or new.content_sha256 is distinct from old.content_sha256)
     and (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Only admins can record where a library file came from.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.kb_items_origin_once() from public, anon, authenticated;

create trigger kb_items_origin_once
  before update of drive_file_id, content_sha256 on public.kb_items
  for each row execute function public.kb_items_origin_once();
