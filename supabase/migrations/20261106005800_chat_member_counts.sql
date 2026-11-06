-- Lawdeck migration 58: how many people are in each chat group, for the group's header (founder,
-- 2026-11-06; docs/specs/chat.md). A number only: no member list, so nobody can collect names.
-- Members are people who accepted the community rules and are verified for the group: their campus
-- for a campus group, any student campus for All campuses, aspirants for Aspirants.
create function public.chat_member_counts()
returns table (group_id uuid, members bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, count(m.owner_id)
    from public.chat_groups g
    left join public.chat_verifications v
      on v.status = 'approved'
     and ((g.kind = 'all' and v.campus_key <> 'aspirant') or v.campus_key = g.campus_key)
    left join public.chat_members m on m.owner_id = v.owner_id
   where public.chat_group_visible(g.id)
   group by g.id;
$$;
revoke execute on function public.chat_member_counts() from public, anon;
grant execute on function public.chat_member_counts() to authenticated;
