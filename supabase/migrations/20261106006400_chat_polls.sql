-- Lawdeck migration 64: polls in chat (founder, 2026-11-06; docs/specs/chat.md, step 4e).
-- Founder's decisions: polls in any group the student can see; 2 to 6 choices; one vote each, which
-- can be changed until the poll closes; results show after voting or once closed; anonymous unless
-- the maker shows names (study groups only); the maker closes it early, or it closes after 1, 3 or
-- 7 days. The question is the message's text, so it goes through the same word filter,
-- contact-details check and posting limit; the choices are checked the same way. Report and admin
-- Hide work on the message. Nobody reads or writes the poll tables directly: every change goes
-- through the functions below.

-- 1. A message may be a poll. Set only by chat_poll_create.
alter table public.chat_messages add column poll boolean not null default false;

-- 2. Polls and votes.
create table public.chat_polls (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.chat_messages (id) on delete cascade,
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  choices text[] not null check (cardinality(choices) between 2 and 6),
  show_names boolean not null default false,
  closes_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index chat_polls_group on public.chat_polls (group_id);
alter table public.chat_polls enable row level security;
revoke all on public.chat_polls from anon, authenticated;

create table public.chat_poll_votes (
  poll_id uuid not null references public.chat_polls (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  choice int not null check (choice between 0 and 5),
  voted_at timestamptz not null default now(),
  primary key (poll_id, owner_id)
);
alter table public.chat_poll_votes enable row level security;
revoke all on public.chat_poll_votes from anon, authenticated;

-- 3. Making a poll: a member of a group they can see. Returns the message's id.
create function public.chat_poll_create(g uuid, question text, options text[], days int, names boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  q text := btrim(coalesce(question, ''));
  opts text[];
  new_id uuid;
begin
  if me is null or not public.chat_group_visible(g)
     or not exists (select 1 from public.chat_members m where m.owner_id = me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select coalesce(array_agg(btrim(o) order by n), '{}') into opts
    from unnest(coalesce(options, '{}')) with ordinality as x(o, n)
   where btrim(o) <> '';
  if char_length(q) not between 1 and 200
     or cardinality(opts) not between 2 and 6
     or exists (select 1 from unnest(opts) o where char_length(o) > 80)
     or (select count(distinct lower(o)) from unnest(opts) o) <> cardinality(opts)
     or days not in (1, 3, 7) then
    raise exception 'poll_invalid' using errcode = '23514';
  end if;
  if coalesce(names, false) and not exists (select 1 from public.chat_groups where id = g and kind = 'study') then
    raise exception 'poll_names' using errcode = '23514';
  end if;
  if public.chat_blocked_word(array_to_string(opts, ' ')) is not null then
    raise exception 'blocked_word' using errcode = '23514';
  end if;
  if public.chat_has_contact_details(array_to_string(opts, ' ')) then
    raise exception 'contact_details' using errcode = '23514';
  end if;
  -- The message trigger checks the question (word filter, contact details, posting limit).
  insert into public.chat_messages (group_id, owner_id, body, poll) values (g, me, q, true) returning id into new_id;
  insert into public.chat_polls (message_id, group_id, owner_id, choices, show_names, closes_at)
    values (new_id, g, me, opts, coalesce(names, false), now() + make_interval(days => days));
  return new_id;
end;
$$;
revoke execute on function public.chat_poll_create(uuid, text, text[], int, boolean) from public, anon;
grant execute on function public.chat_poll_create(uuid, text, text[], int, boolean) to authenticated;

-- A poll the caller can see: its group is visible to them and its message is not hidden.
create function public.chat_poll_visible(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_polls cp join public.chat_messages m on m.id = cp.message_id
     where cp.id = p and m.hidden_at is null and public.chat_group_visible(cp.group_id));
$$;
revoke execute on function public.chat_poll_visible(uuid) from public, anon, authenticated;

-- 4. Voting, or changing a vote, while the poll is open. Chat members only.
create function public.chat_poll_vote(p uuid, pick int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  poll public.chat_polls;
begin
  if me is null or not public.chat_poll_visible(p)
     or not exists (select 1 from public.chat_members m where m.owner_id = me) then
    return 'not_allowed';
  end if;
  select * into poll from public.chat_polls where id = p;
  if poll.closed_at is not null or poll.closes_at <= now() then
    return 'closed';
  end if;
  if pick is null or pick < 0 or pick >= cardinality(poll.choices) then
    return 'not_allowed';
  end if;
  insert into public.chat_poll_votes (poll_id, owner_id, choice) values (p, me, pick)
    on conflict (poll_id, owner_id) do update set choice = excluded.choice, voted_at = now();
  return 'ok';
end;
$$;
revoke execute on function public.chat_poll_vote(uuid, int) from public, anon;
grant execute on function public.chat_poll_vote(uuid, int) to authenticated;

-- 5. Closing early: the poll's maker only.
create function public.chat_poll_close(p uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not public.chat_poll_visible(p) or not exists (select 1 from public.chat_polls where id = p and owner_id = me) then
    return 'not_allowed';
  end if;
  update public.chat_polls set closed_at = now() where id = p and closed_at is null and closes_at > now();
  return 'ok';
end;
$$;
revoke execute on function public.chat_poll_close(uuid) from public, anon;
grant execute on function public.chat_poll_close(uuid) to authenticated;

-- 6. What poll cards show, for messages the caller can see. Counts (and, when the maker chose to
-- show them, who voted for each choice) only after the caller has voted or once the poll is closed.
create function public.chat_poll_cards(messages uuid[])
returns table (message_id uuid, poll_id uuid, choices text[], show_names boolean, closes_at timestamptz, closed boolean,
               mine boolean, my_choice int, counts int[], voters jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  polls as (
    select cp.*, (cp.closed_at is not null or cp.closes_at <= now()) as is_closed,
           (select v.choice from public.chat_poll_votes v, me where v.poll_id = cp.id and v.owner_id = me.id) as mine_choice
      from public.chat_polls cp
      join public.chat_messages m on m.id = cp.message_id
     where cp.message_id = any (messages)
       and cardinality(messages) <= 100
       and public.chat_group_visible(cp.group_id)
       and (m.hidden_at is null or public.is_reviewer())
  )
  select p.message_id, p.id, p.choices, p.show_names, p.closes_at, p.is_closed, p.owner_id = me.id, p.mine_choice,
         case when p.is_closed or p.mine_choice is not null then
           array(select (select count(*)::int from public.chat_poll_votes v where v.poll_id = p.id and v.choice = i - 1)
                   from generate_subscripts(p.choices, 1) i order by i)
         end,
         case when p.show_names and (p.is_closed or p.mine_choice is not null) then
           (select jsonb_agg(coalesce((select jsonb_agg(v.owner_id order by v.voted_at) from public.chat_poll_votes v
                                        where v.poll_id = p.id and v.choice = i - 1), '[]'::jsonb) order by i)
              from generate_subscripts(p.choices, 1) i)
         end
    from polls p, me;
$$;
revoke execute on function public.chat_poll_cards(uuid[]) from public, anon;
grant execute on function public.chat_poll_cards(uuid[]) to authenticated;
