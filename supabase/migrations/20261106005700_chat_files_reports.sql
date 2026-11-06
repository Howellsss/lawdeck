-- Lawdeck migration 57: campus chat, Phase 3 (PRD v2.1 CH-06, CH-09; docs/specs/chat.md;
-- founder approved 2026-11-06). Files in messages, Report a message, admin Hide, and the switch that
-- opens chat to verified students (chat_settings.open_to_students, migration 55, changed by admins).

-- 1. Files: up to 4 per message (PDF, Word, PNG, JPEG, 25 MB each), in a private store whose first
-- folder is the group. Only people who can see the group can open them; people add files only to
-- their own folder in a group they belong to. The app checks each file's real type before posting.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-files', 'chat-files', false, 26214400,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;

create function public.chat_file_group(name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(name, '/', 1)::uuid end;
$$;
revoke execute on function public.chat_file_group(text) from public, anon;
grant execute on function public.chat_file_group(text) to authenticated;

create policy "Chat users open files in their groups" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-files' and public.chat_group_visible(public.chat_file_group(name)));
create policy "Members add files to their own folder in their groups" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-files'
    and split_part(name, '/', 2) = (select auth.uid())::text
    and public.chat_group_visible(public.chat_file_group(name))
    and exists (select 1 from public.chat_members m where m.owner_id = (select auth.uid())));
create policy "People remove their own chat files; admins any" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-files' and (split_part(name, '/', 2) = (select auth.uid())::text or public.is_admin()));

-- A message may be files only, so the text may be empty when files are attached.
alter table public.chat_messages drop constraint chat_messages_body_check;
alter table public.chat_messages add constraint chat_messages_body_check check (char_length(body) <= 4000);
alter table public.chat_messages
  add column attachments jsonb not null default '[]'
  check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 4);
grant insert (attachments) on public.chat_messages to authenticated;

create or replace function public.chat_messages_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f jsonb;
  names text := '';
begin
  if btrim(new.body) = '' and jsonb_array_length(new.attachments) = 0 then
    raise exception 'A message needs words or a file.' using errcode = '23514';
  end if;
  for f in select * from jsonb_array_elements(new.attachments) loop
    if jsonb_typeof(f) <> 'object'
       or coalesce(f ->> 'path', '') !~ ('^' || new.group_id::text || '/' || new.owner_id::text || '/[0-9a-f-]{36}\.(pdf|docx|png|jpg)$')
       or coalesce(f ->> 'kind', '') not in ('pdf', 'docx', 'png', 'jpeg')
       or char_length(coalesce(f ->> 'name', '')) not between 1 and 200
       or coalesce((f ->> 'size')::bigint, 0) not between 1 and 26214400 then
      raise exception 'That file could not be attached.' using errcode = '23514';
    end if;
    names := names || ' ' || (f ->> 'name');
  end loop;
  if exists (select 1 from unnest(new.hashtags) h where h !~ '^[a-z0-9_]{1,40}$') then
    raise exception 'A hashtag can use letters, numbers and _ only.' using errcode = '23514';
  end if;
  if public.chat_blocked_word(new.body || names) is not null then
    raise exception 'blocked_word' using errcode = '23514';
  end if;
  if public.chat_has_contact_details(new.body || names) then
    raise exception 'contact_details' using errcode = '23514';
  end if;
  if (select count(*) from public.chat_messages
       where owner_id = new.owner_id and created_at > now() - interval '1 minute') >= 8
     or (select count(*) from public.chat_messages
       where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 300 then
    raise exception 'post_limit' using errcode = '23514';
  end if;
  new.created_at := now();
  return new;
end;
$$;

-- 2. Reports: anyone who can see a message can report it once, with a reason.
create table public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('abuse', 'contact', 'cheating', 'spam', 'other')),
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (message_id, owner_id)
);
alter table public.chat_reports enable row level security;
create index chat_reports_open_idx on public.chat_reports (status, created_at);
revoke all on public.chat_reports from anon, authenticated;
grant select on public.chat_reports to authenticated;
grant insert (message_id, reason, note) on public.chat_reports to authenticated;
grant update (status) on public.chat_reports to authenticated;

create function public.chat_message_visible(msg uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.chat_messages m where m.id = msg and m.hidden_at is null and public.chat_group_visible(m.group_id));
$$;
revoke execute on function public.chat_message_visible(uuid) from public, anon;
grant execute on function public.chat_message_visible(uuid) to authenticated;

create policy "People read their own reports; admins all" on public.chat_reports
  for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
create policy "Chat users report messages they can see" on public.chat_reports
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.chat_message_visible(message_id));
create policy "Admins close reports" on public.chat_reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3. Admins hide a message for everyone (or show it again); hiding closes its reports.
create function public.chat_set_hidden(msg uuid, hide boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return 'not_allowed';
  end if;
  update public.chat_messages
     set hidden_at = case when hide then now() end, hidden_by = case when hide then (select auth.uid()) end
   where id = msg;
  if not found then
    return 'not_found';
  end if;
  if hide then
    update public.chat_reports set status = 'closed' where message_id = msg;
  end if;
  return 'ok';
end;
$$;
revoke execute on function public.chat_set_hidden(uuid, boolean) from public, anon;
grant execute on function public.chat_set_hidden(uuid, boolean) to authenticated;

-- Admins' list of reported messages: the message, where, who wrote it and the reports.
create function public.chat_report_queue()
returns table (
  message_id uuid, body text, attachments jsonb, group_name text, author text, author_email text,
  posted_at timestamptz, hidden boolean, reports bigint, open_reports bigint, reasons text[], notes text[], last_report timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.body, m.attachments, g.name,
         coalesce(nullif(trim(p.full_name), ''), nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''), 'Lawdeck student'),
         u.email::text, m.created_at, m.hidden_at is not null,
         count(r.id), count(r.id) filter (where r.status = 'open'),
         array_agg(distinct r.reason), array_remove(array_agg(r.note), null), max(r.created_at)
    from public.chat_reports r
    join public.chat_messages m on m.id = r.message_id
    join public.chat_groups g on g.id = m.group_id
    join auth.users u on u.id = m.owner_id
    left join public.profiles p on p.id = m.owner_id
   where public.is_admin()
   group by m.id, g.name, p.full_name, u.raw_user_meta_data, u.email
   order by count(r.id) filter (where r.status = 'open') desc, max(r.created_at) desc
   limit 200;
$$;
revoke execute on function public.chat_report_queue() from public, anon;
grant execute on function public.chat_report_queue() to authenticated;
