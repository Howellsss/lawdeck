-- Lawdeck migration 55: campus chat, Phase 2 (PRD v2.1 CH-02 to CH-10; docs/specs/chat.md;
-- founder approved 2026-11-06). Open groups, one per campus plus Aspirants and All campuses, where
-- everyone in chat can read and post. Messages appear straight away (founder's exception, recorded
-- in CLAUDE.md), with the safeguards the database itself enforces:
--   * vulgar and curse words: a message containing one is refused (check_violation 'blocked_word');
--   * a posting limit: 8 messages a minute, 300 a day (check_violation 'post_limit');
--   * community rules: only people who accepted them (chat_members) can post.
-- Phase 2 is for staff only: chat_allowed() is true for reviewers and admins, and for students only
-- once an admin opens chat (chat_settings.open_to_students, Phase 3).

-- 1. Who may use chat, and the switch that opens it to students.
create table public.chat_settings (
  id boolean primary key default true check (id),
  open_to_students boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.chat_settings default values;
alter table public.chat_settings enable row level security;
revoke all on public.chat_settings from anon, authenticated;
grant select on public.chat_settings to authenticated;
grant update (open_to_students, updated_at) on public.chat_settings to authenticated;
create policy "Signed-in users read the chat switch" on public.chat_settings
  for select to authenticated using (true);
create policy "Admins open or close chat" on public.chat_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create function public.chat_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_reviewer()
      or (public.has_pilot_access() and coalesce((select open_to_students from public.chat_settings), false));
$$;
revoke execute on function public.chat_allowed() from public, anon;
grant execute on function public.chat_allowed() to authenticated;

-- 2. Groups: one per campus (from migration 54's list), Aspirants, and All campuses. Reference
-- data: read by anyone allowed in chat, changed only by migration.
create table public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z-]{1,39}$'),
  name text not null check (char_length(name) between 2 and 60),
  kind text not null check (kind in ('all', 'campus', 'aspirants')),
  campus_key text references public.campuses (key) on update cascade,
  position integer not null unique
);
alter table public.chat_groups enable row level security;
revoke all on public.chat_groups from anon, authenticated;
grant select on public.chat_groups to authenticated;
create policy "Chat users read the groups" on public.chat_groups
  for select to authenticated using (public.chat_allowed());

insert into public.chat_groups (key, name, kind, campus_key, position)
  values ('all-campuses', 'All campuses', 'all', null, 0);
insert into public.chat_groups (key, name, kind, campus_key, position)
  select key, case when kind = 'aspirant' then 'Aspirants' else name end,
         case when kind = 'aspirant' then 'aspirants' else 'campus' end, key, position
    from public.campuses;

-- 3. Members: people who accepted the community rules. Only they can post or be @mentioned.
create table public.chat_members (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  accepted_rules_at timestamptz not null default now()
);
alter table public.chat_members enable row level security;
revoke all on public.chat_members from anon, authenticated;
grant select, delete on public.chat_members to authenticated;
grant insert (owner_id) on public.chat_members to authenticated;
create policy "Members read their own membership" on public.chat_members
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "People accept the rules for themselves" on public.chat_members
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.chat_allowed());
create policy "Members leave chat" on public.chat_members
  for delete to authenticated using (owner_id = (select auth.uid()));

-- 4. Blocked words (vulgar and curse words, English and Nigerian Pidgin). Admin-kept data; the
-- check compares whole words after lower-casing, common look-alike characters (@ for a, 0 for o …)
-- and repeated letters (fuuuck) are evened out on both sides.
create table public.chat_blocked_words (
  word text primary key check (word ~ '^[a-z]{2,30}$')
);
alter table public.chat_blocked_words enable row level security;
revoke all on public.chat_blocked_words from anon, authenticated;
grant select, insert, delete on public.chat_blocked_words to authenticated;
create policy "Admins read blocked words" on public.chat_blocked_words
  for select to authenticated using (public.is_admin());
create policy "Admins add blocked words" on public.chat_blocked_words
  for insert to authenticated with check (public.is_admin());
create policy "Admins remove blocked words" on public.chat_blocked_words
  for delete to authenticated using (public.is_admin());

insert into public.chat_blocked_words (word) values
  ('fuck'), ('fucks'), ('fucked'), ('fucker'), ('fuckers'), ('fucking'), ('fuckin'), ('motherfucker'),
  ('shit'), ('shits'), ('shitty'), ('bullshit'), ('bitch'), ('bitches'), ('bastard'), ('bastards'),
  ('asshole'), ('assholes'), ('arsehole'), ('dickhead'), ('cunt'), ('cunts'), ('pussy'), ('whore'),
  ('whores'), ('slut'), ('sluts'), ('nigga'), ('niggas'), ('nigger'), ('cocksucker'), ('wanker'),
  ('twat'), ('bollocks'), ('wtf'), ('stfu'),
  ('ashawo'), ('ashewo'), ('olosho'), ('oloshi'), ('werey'), ('toto'), ('gbola');

-- Evens out a text for the check: lower case, look-alike characters, repeated letters.
create function public.chat_normalise(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(translate(lower(coalesce(t, '')), '@$01345!|', 'asoieasil'), '([a-z])\1+', '\1', 'g');
$$;
revoke execute on function public.chat_normalise(text) from public, anon, authenticated;

-- The first blocked word in a text, or null. Whole words only, so "Dickens" or "cockroach" pass.
create function public.chat_blocked_word(body text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select w.word
    from regexp_split_to_table(public.chat_normalise(body), '[^a-z]+') as token
    join public.chat_blocked_words w on public.chat_normalise(w.word) = token
   where token <> ''
   limit 1;
$$;
revoke execute on function public.chat_blocked_word(text) from public, anon;
grant execute on function public.chat_blocked_word(text) to authenticated;

-- 5. Messages.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The message as typed: a small Markdown-like set (bold, italic, strike, links, lists, quote,
  -- code), with @mentions stored as @[Name](person id). Shown by Lawdeck's own renderer.
  body text not null check (char_length(body) between 1 and 4000),
  mentions uuid[] not null default '{}' check (cardinality(mentions) <= 20),
  hashtags text[] not null default '{}' check (cardinality(hashtags) <= 20),
  created_at timestamptz not null default now(),
  -- Phase 3: an admin hides a message for everyone.
  hidden_at timestamptz,
  hidden_by uuid references auth.users (id) on delete set null
);
alter table public.chat_messages enable row level security;
create index chat_messages_group_idx on public.chat_messages (group_id, created_at desc);
create index chat_messages_hashtags_idx on public.chat_messages using gin (hashtags);

revoke all on public.chat_messages from anon, authenticated;
grant select, delete on public.chat_messages to authenticated;
grant insert (group_id, body, mentions, hashtags) on public.chat_messages to authenticated;
create policy "Chat users read messages that are not hidden" on public.chat_messages
  for select to authenticated using (public.chat_allowed() and (hidden_at is null or public.is_reviewer()));
create policy "Members post as themselves" on public.chat_messages
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and public.chat_allowed()
    and exists (select 1 from public.chat_members m where m.owner_id = (select auth.uid())));
create policy "People delete their own messages" on public.chat_messages
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Every hashtag is a short word; the word filter and the posting limit run before saving.
create function public.chat_messages_check()
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
revoke execute on function public.chat_messages_check() from public, anon, authenticated;
create trigger chat_messages_check
  before insert on public.chat_messages
  for each row execute function public.chat_messages_check();

-- 6. Unread counts: when each member last read each group.
create table public.chat_reads (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (owner_id, group_id)
);
alter table public.chat_reads enable row level security;
revoke all on public.chat_reads from anon, authenticated;
grant select, delete on public.chat_reads to authenticated;
grant insert (group_id, last_read_at), update (group_id, last_read_at) on public.chat_reads to authenticated;
create policy "Members read their own read marks" on public.chat_reads
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Members set their own read marks" on public.chat_reads
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.chat_allowed());
create policy "Members move their own read marks" on public.chat_reads
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Members clear their own read marks" on public.chat_reads
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Unread messages per group for the caller: since their last read, or since they joined chat.
create function public.chat_unread_counts()
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
   where public.chat_allowed()
   group by g.id;
$$;
revoke execute on function public.chat_unread_counts() from public, anon;
grant execute on function public.chat_unread_counts() to authenticated;

-- 7. Names and campuses of chat members, for messages and @mention suggestions. Only members,
-- only for people allowed in chat, and never an email address.
create function public.chat_people(people uuid[])
returns table (id uuid, name text, campus text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.owner_id,
         left(coalesce(nullif(trim(p.full_name), ''), nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
                       nullif(trim(u.raw_user_meta_data ->> 'name'), ''), 'Lawdeck student'), 80),
         c.name
    from public.chat_members m
    join public.profiles p on p.id = m.owner_id
    join auth.users u on u.id = m.owner_id
    left join public.campuses c on c.key = p.campus
   where public.chat_allowed() and m.owner_id = any (people)
   limit 200;
$$;
revoke execute on function public.chat_people(uuid[]) from public, anon;
grant execute on function public.chat_people(uuid[]) to authenticated;

create function public.chat_people_search(q text)
returns table (id uuid, name text, campus text)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.name, x.campus
    from public.chat_people(array(select owner_id from public.chat_members)) x
   where char_length(coalesce(q, '')) between 1 and 40
     and (x.name ilike q || '%' or x.name ilike '% ' || q || '%')
   order by x.name
   limit 8;
$$;
revoke execute on function public.chat_people_search(text) from public, anon;
grant execute on function public.chat_people_search(text) to authenticated;
