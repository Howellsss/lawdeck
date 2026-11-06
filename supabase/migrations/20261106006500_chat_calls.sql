-- Lawdeck migration 65: group calls in study groups (founder, 2026-11-06; docs/specs/chat.md, step 4f).
-- Founder's decisions: calls happen inside Lawdeck, in study groups only, on LiveKit's free plan to
-- start; audio first (cameras off until a student turns theirs on); at most 15 people; never
-- recorded. A monthly limit of call-minutes (set by admins, just under the free plan's 5,000) keeps
-- Lawdeck from going over: when it is reached, calls stop until the next month. This database keeps
-- only who was in which call and for how long, for the limit and the admin usage count: no audio,
-- no video. Every change goes through the functions below.

-- 1. The monthly limit, changed by admins on Admin -> Chat.
alter table public.chat_settings add column call_minutes_month int not null default 4500 check (call_minutes_month between 0 and 10000000);
grant update (call_minutes_month) on public.chat_settings to authenticated;

-- 2. Calls and who was in them. A "segment" is one stretch of time a person was in a call; the
-- browser checks in every 30 seconds while connected.
create table public.chat_calls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  started_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index chat_calls_open on public.chat_calls (group_id) where ended_at is null;
alter table public.chat_calls enable row level security;
revoke all on public.chat_calls from anon, authenticated;

create table public.chat_call_presence (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.chat_calls (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz
);
create index chat_call_presence_call on public.chat_call_presence (call_id, owner_id);
create index chat_call_presence_month on public.chat_call_presence (joined_at);
alter table public.chat_call_presence enable row level security;
revoke all on public.chat_call_presence from anon, authenticated;

-- 3. Call-minutes used this month (West Africa Time), across all of Lawdeck.
create function public.chat_call_minutes_used()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(ceil(sum(extract(epoch from (coalesce(p.left_at, p.last_seen_at) - p.joined_at))) / 60), 0)::int
    from public.chat_call_presence p
   where p.joined_at >= (date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos');
$$;
revoke execute on function public.chat_call_minutes_used() from public, anon, authenticated;

-- People in a call right now: checked in within the last 90 seconds and not left.
create function public.chat_call_live(c uuid)
returns table (owner_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.owner_id from public.chat_call_presence p
   where p.call_id = c and p.left_at is null and p.last_seen_at > now() - interval '90 seconds';
$$;
revoke execute on function public.chat_call_live(uuid) from public, anon, authenticated;

-- A group's current call: not ended, and started in the last 2 minutes or someone is still in it.
create function public.chat_call_current(g uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.chat_calls c
   where c.group_id = g and c.ended_at is null
     and (c.started_at > now() - interval '2 minutes' or exists (select 1 from public.chat_call_live(c.id)))
   order by c.started_at desc
   limit 1;
$$;
revoke execute on function public.chat_call_current(uuid) from public, anon, authenticated;

-- 4. Starting or joining a study group's call. Returns the call and its room name, which only the
-- server uses to give the student a short-lived pass.
create function public.chat_call_join(g uuid)
returns table (call_id uuid, room text, started boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c uuid;
  is_new boolean := false;
begin
  if me is null or not public.chat_group_visible(g)
     or not exists (select 1 from public.chat_groups where id = g and kind = 'study')
     or not exists (select 1 from public.chat_members m where m.owner_id = me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if public.chat_call_minutes_used() >= (select call_minutes_month from public.chat_settings where id) then
    raise exception 'call_budget' using errcode = '23514';
  end if;
  c := public.chat_call_current(g);
  if c is null then
    update public.chat_calls set ended_at = now() where group_id = g and ended_at is null;
    insert into public.chat_calls (group_id, started_by) values (g, me) returning id into c;
    is_new := true;
    insert into public.chat_messages (group_id, owner_id, body) values (g, me, '📞 Started a group call');
  elsif (select count(*) from public.chat_call_live(c) l where l.owner_id <> me) >= 15 then
    raise exception 'call_full' using errcode = '23514';
  end if;
  update public.chat_call_presence set left_at = now() where chat_call_presence.call_id = c and owner_id = me and left_at is null;
  insert into public.chat_call_presence (call_id, owner_id) values (c, me);
  return query select c, 'lawdeck-' || c::text, is_new;
end;
$$;
revoke execute on function public.chat_call_join(uuid) from public, anon;
grant execute on function public.chat_call_join(uuid) to authenticated;

-- 5. The browser's check-in while connected: 'ok' to stay, or why the call must end for everyone
-- ('budget': the monthly limit is reached; 'too_long': calls last up to 3 hours) or for this
-- person ('end': they left the group, or the call already ended).
create function public.chat_call_heartbeat(c uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  cr public.chat_calls;
  seg uuid;
begin
  select * into cr from public.chat_calls where id = c;
  select p.id into seg from public.chat_call_presence p
   where p.call_id = c and p.owner_id = me and p.left_at is null order by p.joined_at desc limit 1;
  if me is null or cr.id is null or seg is null then
    return 'end';
  end if;
  if cr.ended_at is not null or not public.chat_group_visible(cr.group_id) then
    update public.chat_call_presence set left_at = now() where id = seg;
    return 'end';
  end if;
  update public.chat_call_presence set last_seen_at = now() where id = seg;
  if cr.started_at < now() - interval '3 hours' then
    update public.chat_calls set ended_at = now() where id = c;
    update public.chat_call_presence set left_at = now() where call_id = c and left_at is null;
    return 'too_long';
  end if;
  if public.chat_call_minutes_used() >= (select call_minutes_month from public.chat_settings where id) then
    update public.chat_calls set ended_at = now() where id = c;
    update public.chat_call_presence set left_at = now() where call_id = c and left_at is null;
    return 'budget';
  end if;
  return 'ok';
end;
$$;
revoke execute on function public.chat_call_heartbeat(uuid) from public, anon;
grant execute on function public.chat_call_heartbeat(uuid) to authenticated;

-- 6. Leaving. The call ends when the last person leaves.
create function public.chat_call_leave(c uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  update public.chat_call_presence set left_at = now(), last_seen_at = now() where call_id = c and owner_id = me and left_at is null;
  if found and not exists (select 1 from public.chat_call_live(c)) then
    update public.chat_calls set ended_at = now() where id = c and ended_at is null;
  end if;
end;
$$;
revoke execute on function public.chat_call_leave(uuid) from public, anon;
grant execute on function public.chat_call_leave(uuid) to authenticated;

-- 7. Whether a study group has a call going, and who is in it (for "Call in progress · Join").
create function public.chat_call_status(g uuid)
returns table (call_id uuid, started_at timestamptz, people uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.started_at, array(select l.owner_id from public.chat_call_live(c.id) l)
    from public.chat_calls c
   where c.id = public.chat_call_current(g) and public.chat_group_visible(g);
$$;
revoke execute on function public.chat_call_status(uuid) from public, anon;
grant execute on function public.chat_call_status(uuid) to authenticated;

-- 8. Usage this month, for admins (Admin -> Chat).
create function public.chat_call_usage()
returns table (used int, monthly_limit int, calls int)
language sql
stable
security definer
set search_path = ''
as $$
  select public.chat_call_minutes_used(), s.call_minutes_month,
         (select count(*)::int from public.chat_calls c
           where c.started_at >= (date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'))
    from public.chat_settings s
   where s.id and public.is_admin();
$$;
revoke execute on function public.chat_call_usage() from public, anon;
grant execute on function public.chat_call_usage() to authenticated;
