-- Lawdeck migration 69: PowerPoint slides and large files in the library (founder, 2026-11-22).
-- Library files added by admins may now be PowerPoint (.pptx) and up to 100 MB. Students' own
-- uploads are unchanged (their own store, 25 MB, no slides). Needs migrations 1–68.

-- 1. The library file store and its archive of originals: up to 100 MB, and PowerPoint.
update storage.buckets
   set file_size_limit = 104857600,
       allowed_mime_types = array[
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'image/png',
         'image/jpeg',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation']
 where id in ('library', 'library-archive');

-- 2. Library items may record files up to 100 MB.
alter table public.kb_items drop constraint if exists kb_items_size_bytes_check;
alter table public.kb_items add constraint kb_items_size_bytes_check check (size_bytes between 0 and 104857600);
