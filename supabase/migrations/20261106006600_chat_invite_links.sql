-- Lawdeck migration 66: study group invite links and a test switch for chat ID checks (founder,
-- 2026-11-06; docs/specs/chat.md, step 4g).
-- Founder's decisions:
--   * A study group's creator can make an invite link. Opening it: sign up or log in, then the chat
--     ID step if needed, then Join. A link lasts 7 days, the creator can turn it off or make a new
--     one (the old one stops working), and it stops at 15 members. Students join student groups,
--     aspirants aspirant groups. The link also lets a new person into Lawdeck while invite-only is on.
--     Only a hash of the link's code is stored, so a stolen copy of the database gives no working link.
--   * "Approve IDs automatically (testing)" on Admin -> Chat: off by default. While on, a chat ID
--     request is approved as soon as it is sent, with no document needed. It switches off a safety
--     check, so it is admin-only and meant for testing; turn it off before real students join.

-- 1. The test switch.
alter table public.chat_settings add column auto_approve_ids boolean not null default false;
grant update (auto_approve_ids) on public.chat_settings to authenticated;

-- A request is approved at once while the switch is on (the decision is recorded as automatic:
-- no admin, decided_by stays empty). Otherwise it waits for an admin, as before.
create or replace function public.chat_verifications_decided()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce((select s.auto_approve_ids from public.chat_settings s where s.id), false) then
      new.status := 'approved';
      new.decided_at := now();
      new.decided_by := null;
      new.note := 'Approved automatically (test switch on)';
      update public.profiles set campus = new.campus_key where id = new.owner_id;
    else
      new.status := 'pending';
      new.decided_at := null;
      new.decided_by := null;
    end if;
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

-- 2. Invite links: one working link per group at a time.
create table public.chat_group_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  code_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index chat_group_links_group on public.chat_group_links (group_id) where revoked_at is null;
alter table public.chat_group_links enable row level security;
revoke all on public.chat_group_links from anon, authenticated;

create function public.chat_link_hash(code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(code, ''), 'UTF8')), 'hex');
$$;
revoke execute on function public.chat_link_hash(text) from public, anon, authenticated;

-- The working link for a code, if any (not turned off, not expired, its group still a study group).
create function public.chat_link_find(code text)
returns public.chat_group_links
language sql
stable
security definer
set search_path = ''
as $$
  select l.* from public.chat_group_links l join public.chat_groups g on g.id = l.group_id and g.kind = 'study'
   where char_length(coalesce(code, '')) between 20 and 100
     and l.code_hash = public.chat_link_hash(code) and l.revoked_at is null and l.expires_at > now();
$$;
revoke execute on function public.chat_link_find(text) from public, anon, authenticated;

-- 3. Making a new link (the old one stops working): the group's creator only. Returns the code once.
create function public.chat_link_create(g uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  code text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if me is null or not public.chat_group_visible(g)
     or not exists (select 1 from public.chat_groups where id = g and kind = 'study' and owner_id = me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.chat_group_links set revoked_at = now() where group_id = g and revoked_at is null;
  insert into public.chat_group_links (group_id, code_hash, created_by, expires_at)
    values (g, public.chat_link_hash(code), me, now() + interval '7 days');
  return code;
end;
$$;
revoke execute on function public.chat_link_create(uuid) from public, anon;
grant execute on function public.chat_link_create(uuid) to authenticated;

-- Turning the link off: the group's creator only.
create function public.chat_link_revoke(g uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.chat_groups where id = g and kind = 'study' and owner_id = (select auth.uid())) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.chat_group_links set revoked_at = now() where group_id = g and revoked_at is null;
end;
$$;
revoke execute on function public.chat_link_revoke(uuid) from public, anon;
grant execute on function public.chat_link_revoke(uuid) to authenticated;

-- Whether the group has a working link, and until when (the creator's Members tab).
create function public.chat_link_status(g uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(l.expires_at) from public.chat_group_links l join public.chat_groups grp on grp.id = l.group_id
   where l.group_id = g and grp.owner_id = (select auth.uid()) and l.revoked_at is null and l.expires_at > now();
$$;
revoke execute on function public.chat_link_status(uuid) from public, anon;
grant execute on function public.chat_link_status(uuid) to authenticated;

-- 4. Opening a link (signed in): the group's name and what happens next. Results:
--   invalid (no such link, turned off or expired), full, access (Lawdeck access is needed: the link
--   gives it, see chat_link_claim_access), verify (the chat ID step), rules (accept the community
--   rules), other_side (an aspirant and a student group, or the other way), member (already in),
--   ready (can join).
create function public.chat_link_open(code text)
returns table (result text, group_name text, group_key text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  link public.chat_group_links;
  grp public.chat_groups;
begin
  if me is null then
    return query select 'invalid'::text, null::text, null::text;
    return;
  end if;
  link := public.chat_link_find(code);
  if link.id is null then
    return query select 'invalid'::text, null::text, null::text;
    return;
  end if;
  select * into grp from public.chat_groups where id = link.group_id;
  if exists (select 1 from public.chat_group_members where group_id = grp.id and owner_id = me and status = 'member') then
    return query select 'member'::text, grp.name, grp.key;
  elsif (select count(*) from public.chat_group_members where group_id = grp.id) >= 15 then
    return query select 'full'::text, grp.name, null::text;
  elsif not public.has_pilot_access() and not public.is_reviewer() then
    return query select 'access'::text, grp.name, null::text;
  elsif public.chat_scope() is null then
    return query select 'verify'::text, grp.name, null::text;
  elsif public.chat_audience_of(me) is distinct from grp.audience then
    return query select 'other_side'::text, grp.name, null::text;
  elsif not exists (select 1 from public.chat_members m where m.owner_id = me) then
    return query select 'rules'::text, grp.name, null::text;
  else
    return query select 'ready'::text, grp.name, null::text;
  end if;
end;
$$;
revoke execute on function public.chat_link_open(text) from public, anon;
grant execute on function public.chat_link_open(text) to authenticated;

-- A working link lets a signed-in person into Lawdeck while invite-only is on (founder's decision).
create function public.chat_link_claim_access(code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or (public.chat_link_find(code)).id is null then
    return false;
  end if;
  update public.profiles set pilot_access_at = now(), pilot_access_until = null where id = me and pilot_access_at is null;
  return true;
end;
$$;
revoke execute on function public.chat_link_claim_access(text) from public, anon;
grant execute on function public.chat_link_claim_access(text) to authenticated;

-- 5. Joining through a link once every step is done. Returns the group's key.
create function public.chat_link_join(code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  link public.chat_group_links;
  grp public.chat_groups;
begin
  link := public.chat_link_find(code);
  if me is null or link.id is null then
    raise exception 'link_invalid' using errcode = '23514';
  end if;
  select * into grp from public.chat_groups where id = link.group_id;
  if exists (select 1 from public.chat_group_members where group_id = grp.id and owner_id = me and status = 'member') then
    return grp.key;
  end if;
  if public.chat_scope() is null or not exists (select 1 from public.chat_members m where m.owner_id = me)
     or public.chat_audience_of(me) is distinct from grp.audience then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.chat_group_members where group_id = grp.id and owner_id <> me) >= 15 then
    raise exception 'group_full' using errcode = '23514';
  end if;
  insert into public.chat_group_members (group_id, owner_id, status, invited_by) values (grp.id, me, 'member', link.created_by)
    on conflict (group_id, owner_id) do update set status = 'member';
  return grp.key;
end;
$$;
revoke execute on function public.chat_link_join(text) from public, anon;
grant execute on function public.chat_link_join(text) to authenticated;
