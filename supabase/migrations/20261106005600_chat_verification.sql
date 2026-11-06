-- Lawdeck migration 56: who may use campus chat, and which groups they see (founder, 2026-11-06;
-- docs/specs/chat.md). Nobody joins chat on a free account alone:
--   * Verification: a student uploads their Law School ID card or admission letter (an aspirant,
--     their university ID or final-year letter) with their number; an admin approves or rejects it.
--     The document is deleted once decided (the app removes the file; only the decision is kept).
--   * Groups: a verified student sees their own campus group and All campuses; an aspirant sees only
--     Aspirants. Staff see every group.
--   * No contact harvesting: phone numbers, email addresses and WhatsApp, Telegram or social links
--     are refused in messages, like blocked words (check_violation 'contact_details').
-- An admin can revoke a verification, which removes that person from chat for good.

-- 1. Verifications.
create table public.chat_verifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('student', 'aspirant')),
  campus_key text not null references public.campuses (key) on update cascade,
  id_number text not null check (char_length(id_number) between 3 and 40),
  -- The uploaded ID, in the private chat-ids store, until an admin decides.
  document_path text check (char_length(document_path) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  constraint chat_verifications_kind_campus check ((kind = 'aspirant') = (campus_key = 'aspirant'))
);
alter table public.chat_verifications enable row level security;
create unique index chat_verifications_one_open on public.chat_verifications (owner_id) where status in ('pending', 'approved');
create index chat_verifications_status_idx on public.chat_verifications (status, created_at);

revoke all on public.chat_verifications from anon, authenticated;
grant select on public.chat_verifications to authenticated;
grant insert (kind, campus_key, id_number, document_path) on public.chat_verifications to authenticated;
grant update (status, note, document_path) on public.chat_verifications to authenticated;

create policy "People read their own verification; admins read all" on public.chat_verifications
  for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
-- Anyone signed in may ask to be verified, unless they were removed from chat before.
create function public.chat_was_removed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.chat_verifications v where v.owner_id = (select auth.uid()) and v.status = 'revoked');
$$;
revoke execute on function public.chat_was_removed() from public, anon;
grant execute on function public.chat_was_removed() to authenticated;
create policy "People ask to be verified" on public.chat_verifications
  for insert to authenticated with check (owner_id = (select auth.uid()) and not public.chat_was_removed());
create policy "Admins decide verifications" on public.chat_verifications
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- A decision records who and when; approval sets the person's campus to the verified one.
create function public.chat_verifications_decided()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.decided_at := null;
    new.decided_by := null;
    return new;
  end if;
  if new.status is distinct from old.status then
    new.decided_at := now();
    new.decided_by := (select auth.uid());
    if new.status = 'approved' then
      update public.profiles set campus = new.campus_key where id = new.owner_id;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.chat_verifications_decided() from public, anon, authenticated;
create trigger chat_verifications_decided
  before insert or update on public.chat_verifications
  for each row execute function public.chat_verifications_decided();

-- 2. The private store for ID documents: each person's own folder; only admins read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-ids', 'chat-ids', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "People add their own ID document" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-ids' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "Admins read ID documents; people their own" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-ids' and (public.is_admin() or split_part(name, '/', 1) = (select auth.uid())::text));
create policy "Admins and owners remove ID documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-ids' and (public.is_admin() or split_part(name, '/', 1) = (select auth.uid())::text));

-- 3. What the caller may see: '*' for staff; their verified campus key (or 'aspirant') once chat
-- is open to students; otherwise null.
create function public.chat_scope()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_reviewer() then '*'
    when public.has_pilot_access() and coalesce((select open_to_students from public.chat_settings), false) then
      (select v.campus_key from public.chat_verifications v
        where v.owner_id = (select auth.uid()) and v.status = 'approved' limit 1)
  end;
$$;
revoke execute on function public.chat_scope() from public, anon;
grant execute on function public.chat_scope() to authenticated;

create or replace function public.chat_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.chat_scope() is not null;
$$;

-- A group is visible to staff, to students of its campus, and (All campuses) to every verified
-- student; Aspirants only to aspirants.
create function public.chat_group_visible(g uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_groups cg, (select public.chat_scope() as s) x
     where cg.id = g and x.s is not null
       and (x.s = '*' or cg.campus_key = x.s or (cg.kind = 'all' and x.s <> 'aspirant')));
$$;
revoke execute on function public.chat_group_visible(uuid) from public, anon;
grant execute on function public.chat_group_visible(uuid) to authenticated;

drop policy "Chat users read the groups" on public.chat_groups;
create policy "Chat users read the groups they belong to" on public.chat_groups
  for select to authenticated using (public.chat_group_visible(id));

drop policy "Chat users read messages that are not hidden" on public.chat_messages;
create policy "Chat users read messages in their groups" on public.chat_messages
  for select to authenticated using (public.chat_group_visible(group_id) and (hidden_at is null or public.is_reviewer()));
drop policy "Members post as themselves" on public.chat_messages;
create policy "Members post as themselves in their groups" on public.chat_messages
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and public.chat_group_visible(group_id)
    and exists (select 1 from public.chat_members m where m.owner_id = (select auth.uid())));

create or replace function public.chat_unread_counts()
returns table (group_id uuid, unread bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, count(m.id)
    from public.chat_groups g
    join public.chat_members me on me.owner_id = (select auth.uid())
    left join public.chat_reads r on r.group_id = g.id and r.owner_id = me.owner_id
    left join public.chat_messages m
      on m.group_id = g.id and m.hidden_at is null and m.owner_id <> me.owner_id
     and m.created_at > coalesce(r.last_read_at, me.accepted_rules_at)
   where public.chat_group_visible(g.id)
   group by g.id;
$$;

-- 4. No phone numbers, email addresses or contact links in messages.
create function public.chat_has_contact_details(body text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(body, '') ~* '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}'
      or regexp_replace(coalesce(body, ''), '[[:space:]().-]', '', 'g') ~ '(\+?234[789][01][0-9]{8}|(^|[^0-9])0[789][01][0-9]{8}($|[^0-9])|\+[0-9]{10,})'
      or coalesce(body, '') ~* '(wa\.me|whatsapp\.com|t\.me/|telegram\.(me|org)|instagram\.com|facebook\.com|fb\.me|tiktok\.com|snapchat\.com|x\.com/|twitter\.com)';
$$;
revoke execute on function public.chat_has_contact_details(text) from public, anon, authenticated;

create or replace function public.chat_messages_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from unnest(new.hashtags) h where h !~ '^[a-z0-9_]{1,40}$') then
    raise exception 'A hashtag can use letters, numbers and _ only.' using errcode = '23514';
  end if;
  if public.chat_blocked_word(new.body) is not null then
    raise exception 'blocked_word' using errcode = '23514';
  end if;
  if public.chat_has_contact_details(new.body) then
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

-- 5. Admins' list of verification requests, with the person's name and email (admins only).
create function public.chat_verification_queue()
returns table (
  id uuid, owner_id uuid, name text, email text, kind text, campus text, id_number text,
  has_document boolean, status text, note text, created_at timestamptz, decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.owner_id,
         coalesce(nullif(trim(p.full_name), ''), nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), '')),
         u.email::text, v.kind, c.name, v.id_number, v.document_path is not null, v.status, v.note, v.created_at, v.decided_at
    from public.chat_verifications v
    join auth.users u on u.id = v.owner_id
    left join public.profiles p on p.id = v.owner_id
    left join public.campuses c on c.key = v.campus_key
   where public.is_admin()
   order by (v.status = 'pending') desc, v.created_at desc
   limit 300;
$$;
revoke execute on function public.chat_verification_queue() from public, anon;
grant execute on function public.chat_verification_queue() to authenticated;
