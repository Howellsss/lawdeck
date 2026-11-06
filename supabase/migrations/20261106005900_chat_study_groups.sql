-- Lawdeck migration 59: study groups in campus chat (founder, 2026-11-06; docs/specs/chat.md).
-- A verified chat member creates a private study group and invites other chat members by name
-- (never by email or phone): students with students, aspirants with aspirants, up to 15 people.
-- Invited people accept or decline; members can leave; the creator renames it, removes members or
-- deletes it. Only members see the group and its messages and files. Report and admin Hide work
-- as in every group. Every change goes through the functions below; nobody writes the tables
-- directly.

-- 1. Study groups are chat groups of kind 'study', with an owner and an audience.
alter table public.chat_groups drop constraint chat_groups_kind_check;
alter table public.chat_groups add constraint chat_groups_kind_check check (kind in ('all', 'campus', 'aspirants', 'study'));
alter table public.chat_groups alter column position drop not null;
alter table public.chat_groups add column owner_id uuid references auth.users (id) on delete cascade;
alter table public.chat_groups add column audience text check (audience in ('student', 'aspirant'));
alter table public.chat_groups add column created_at timestamptz not null default now();
alter table public.chat_groups add constraint chat_groups_study_shape
  check ((kind = 'study') = (owner_id is not null and audience is not null and position is null and campus_key is null));
create index chat_groups_owner_idx on public.chat_groups (owner_id) where kind = 'study';

-- 2. Who is in a study group: invited, then a member once they accept.
create table public.chat_group_members (
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('invited', 'member')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, owner_id)
);
alter table public.chat_group_members enable row level security;
create index chat_group_members_person_idx on public.chat_group_members (owner_id, status);
revoke all on public.chat_group_members from anon, authenticated;
grant select on public.chat_group_members to authenticated;

-- Which side of chat a person is on: 'aspirant', 'student' (verified Law School students and staff),
-- or null when they are not in chat.
create function public.chat_audience_of(person uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.profiles p where p.id = person and p.role in ('reviewer', 'admin')) then 'student'
    else (select case when v.campus_key = 'aspirant' then 'aspirant' else 'student' end
            from public.chat_verifications v where v.owner_id = person and v.status = 'approved' limit 1)
  end;
$$;
revoke execute on function public.chat_audience_of(uuid) from public, anon, authenticated;

-- Members of a study group see the group; everyone else (staff included) does not.
create or replace function public.chat_group_visible(g uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_groups cg, (select public.chat_scope() as s) x
     where cg.id = g and x.s is not null
       and case
             when cg.kind = 'study' then exists (
               select 1 from public.chat_group_members m
                where m.group_id = cg.id and m.owner_id = (select auth.uid()) and m.status = 'member')
             else x.s = '*' or cg.campus_key = x.s or (cg.kind = 'all' and x.s <> 'aspirant')
           end);
$$;

create policy "People see their own invitations and the members of their groups" on public.chat_group_members
  for select to authenticated using (owner_id = (select auth.uid()) or public.chat_group_visible(group_id));

-- A study group's name: 2 to 60 characters, no blocked words or contact details.
create function public.chat_study_name_ok(group_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select char_length(btrim(coalesce(group_name, ''))) between 2 and 60
     and public.chat_blocked_word(group_name) is null
     and not public.chat_has_contact_details(group_name);
$$;
revoke execute on function public.chat_study_name_ok(text) from public, anon, authenticated;

-- 3. Creating a group: chat members only, at most 10 groups each. Returns the new group's key.
create function public.chat_create_study_group(group_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  side text := public.chat_audience_of(me);
  new_key text;
  new_id uuid;
begin
  if public.chat_scope() is null or side is null or not exists (select 1 from public.chat_members m where m.owner_id = me) then
    return 'not_allowed';
  end if;
  if not public.chat_study_name_ok(group_name) then
    return 'bad_name';
  end if;
  if (select count(*) from public.chat_groups where kind = 'study' and owner_id = me) >= 10 then
    return 'too_many';
  end if;
  new_key := 's-' || array_to_string(array(select chr(97 + floor(random() * 26)::int) from generate_series(1, 10)), '');
  insert into public.chat_groups (key, name, kind, owner_id, audience)
    values (new_key, btrim(group_name), 'study', me, side)
    returning id into new_id;
  insert into public.chat_group_members (group_id, owner_id, status, invited_by) values (new_id, me, 'member', me);
  return new_key;
end;
$$;
revoke execute on function public.chat_create_study_group(text) from public, anon;
grant execute on function public.chat_create_study_group(text) to authenticated;

-- 4. Inviting: any member invites chat members on the same side, up to 15 people in the group.
create function public.chat_invite(g uuid, person uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  grp public.chat_groups;
begin
  select * into grp from public.chat_groups where id = g and kind = 'study';
  if grp.id is null or not public.chat_group_visible(g) then
    return 'not_allowed';
  end if;
  if not exists (select 1 from public.chat_members m where m.owner_id = person)
     or public.chat_audience_of(person) is distinct from grp.audience then
    return 'not_allowed';
  end if;
  if exists (select 1 from public.chat_group_members where group_id = g and owner_id = person) then
    return 'already';
  end if;
  if (select count(*) from public.chat_group_members where group_id = g) >= 15 then
    return 'full';
  end if;
  insert into public.chat_group_members (group_id, owner_id, status, invited_by) values (g, person, 'invited', (select auth.uid()));
  return 'ok';
end;
$$;
revoke execute on function public.chat_invite(uuid, uuid) from public, anon;
grant execute on function public.chat_invite(uuid, uuid) to authenticated;

-- People a member can invite: chat members on the group's side who are not in it yet (names only).
create function public.chat_invite_search(g uuid, q text)
returns table (id uuid, name text, campus text)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.name, x.campus
    from public.chat_groups grp
    cross join lateral public.chat_people_search(q) x
   where grp.id = g and grp.kind = 'study' and public.chat_group_visible(g)
     and public.chat_audience_of(x.id) = grp.audience
     and not exists (select 1 from public.chat_group_members m where m.group_id = g and m.owner_id = x.id);
$$;
revoke execute on function public.chat_invite_search(uuid, text) from public, anon;
grant execute on function public.chat_invite_search(uuid, text) to authenticated;

-- 5. Invitations the caller has, with the group's name and who invited them.
create function public.chat_my_invites()
returns table (group_id uuid, group_name text, invited_by text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select grp.id, grp.name, coalesce((select x.name from public.chat_people(array[m.invited_by]) x limit 1), 'A Lawdeck student'), m.created_at
    from public.chat_group_members m
    join public.chat_groups grp on grp.id = m.group_id
   where m.owner_id = (select auth.uid()) and m.status = 'invited' and public.chat_scope() is not null
   order by m.created_at desc;
$$;
revoke execute on function public.chat_my_invites() from public, anon;
grant execute on function public.chat_my_invites() to authenticated;

create function public.chat_answer_invite(g uuid, accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.chat_scope() is null then
    return 'not_allowed';
  end if;
  if accept then
    update public.chat_group_members set status = 'member'
     where group_id = g and owner_id = (select auth.uid()) and status = 'invited';
  else
    delete from public.chat_group_members where group_id = g and owner_id = (select auth.uid()) and status = 'invited';
  end if;
  return case when found then 'ok' else 'not_found' end;
end;
$$;
revoke execute on function public.chat_answer_invite(uuid, boolean) from public, anon;
grant execute on function public.chat_answer_invite(uuid, boolean) to authenticated;

-- 6. Leaving (the creator deletes the group instead), removing, renaming and deleting.
create function public.chat_leave_group(g uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.chat_groups where id = g and owner_id = (select auth.uid())) then
    return 'owner';
  end if;
  delete from public.chat_group_members where group_id = g and owner_id = (select auth.uid());
  return case when found then 'ok' else 'not_found' end;
end;
$$;
revoke execute on function public.chat_leave_group(uuid) from public, anon;
grant execute on function public.chat_leave_group(uuid) to authenticated;

create function public.chat_remove_member(g uuid, person uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.chat_groups where id = g and kind = 'study' and owner_id = (select auth.uid()))
     or person = (select auth.uid()) then
    return 'not_allowed';
  end if;
  delete from public.chat_group_members where group_id = g and owner_id = person;
  return case when found then 'ok' else 'not_found' end;
end;
$$;
revoke execute on function public.chat_remove_member(uuid, uuid) from public, anon;
grant execute on function public.chat_remove_member(uuid, uuid) to authenticated;

create function public.chat_rename_group(g uuid, group_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.chat_groups where id = g and kind = 'study' and owner_id = (select auth.uid())) then
    return 'not_allowed';
  end if;
  if not public.chat_study_name_ok(group_name) then
    return 'bad_name';
  end if;
  update public.chat_groups set name = btrim(group_name) where id = g;
  return 'ok';
end;
$$;
revoke execute on function public.chat_rename_group(uuid, text) from public, anon;
grant execute on function public.chat_rename_group(uuid, text) to authenticated;

-- Deleting removes the group, its members and its messages. Its files can no longer be opened by
-- anyone (the file store only serves files of groups a person can see).
create function public.chat_delete_group(g uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.chat_groups where id = g and kind = 'study' and (owner_id = (select auth.uid()) or public.is_admin())) then
    return 'not_allowed';
  end if;
  delete from public.chat_groups where id = g;
  return 'ok';
end;
$$;
revoke execute on function public.chat_delete_group(uuid) from public, anon;
grant execute on function public.chat_delete_group(uuid) to authenticated;

-- 7. A study group's members by name, for its Members tab (members only).
create function public.chat_group_people(g uuid)
returns table (id uuid, name text, campus text, status text, is_owner boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.owner_id,
         coalesce(x.name, 'Lawdeck student'),
         x.campus,
         m.status,
         m.owner_id = grp.owner_id
    from public.chat_group_members m
    join public.chat_groups grp on grp.id = m.group_id
    left join lateral public.chat_people(array[m.owner_id]) x on true
   where m.group_id = g and public.chat_group_visible(g)
   order by m.owner_id = grp.owner_id desc, m.status desc, x.name;
$$;
revoke execute on function public.chat_group_people(uuid) from public, anon;
grant execute on function public.chat_group_people(uuid) to authenticated;

-- 8. Member counts include study groups (their accepted members).
create or replace function public.chat_member_counts()
returns table (group_id uuid, members bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id,
         case when g.kind = 'study' then
           (select count(*) from public.chat_group_members gm where gm.group_id = g.id and gm.status = 'member')
         else
           (select count(m.owner_id)
              from public.chat_verifications v
              join public.chat_members m on m.owner_id = v.owner_id
             where v.status = 'approved'
               and ((g.kind = 'all' and v.campus_key <> 'aspirant') or v.campus_key = g.campus_key))
         end
    from public.chat_groups g
   where public.chat_group_visible(g.id);
$$;
