-- Lawdeck migration 5: the private "library" file store (Supabase Storage).
-- Students have no access at all. Reviewers can read files; admins can add and remove them.
-- Accepted: PDF, Word (DOCX), PNG and JPEG, up to 25 MB each (CLAUDE.md, Security).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library',
  'library',
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

create policy "Reviewers read library files" on storage.objects
  for select to authenticated
  using (bucket_id = 'library' and public.is_reviewer());

create policy "Admins add library files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'library' and public.is_admin());

create policy "Admins replace library files" on storage.objects
  for update to authenticated
  using (bucket_id = 'library' and public.is_admin())
  with check (bucket_id = 'library' and public.is_admin());

create policy "Admins remove library files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'library' and public.is_admin());
