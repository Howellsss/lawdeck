-- Lawdeck migration 77: sign-ups from shared internet addresses (founder, 2026-11-28, launch audit:
-- "fix 1").
-- Nigerian mobile networks and campus Wi-Fi put many students behind one internet address, so
-- the limit of 20 sign-ups (and resets, and resent emails) an hour per address would turn students
-- away on launch day. It is now 300 an hour per address. The limits per email address are
-- unchanged (5 an hour), as is the pause after 5 wrong passwords, and Supabase's own limits stay on
-- underneath.
-- Needs migrations 1–76.

create or replace function public.auth_wait_seconds(kind text, email_hash text, ip_hash text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  oldest timestamptz;
begin
  if email_hash !~ '^[0-9a-f]{64}$' or ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Not a valid attempt.' using errcode = '22023';
  end if;
  if kind = 'sign_in' then
    -- The 5th most recent wrong password in the last 15 minutes; the pause ends 15 minutes after it.
    select a.created_at into oldest from public.auth_attempts a
     where a.kind = 'sign_in_failed' and a.email_hash = auth_wait_seconds.email_hash
       and a.created_at > now() - interval '15 minutes'
     order by a.created_at desc offset 4 limit 1;
    return case when oldest is null then 0
                else greatest(1, ceil(extract(epoch from (oldest + interval '15 minutes' - now())))::integer) end;
  elsif kind in ('sign_up', 'reset', 'resend') then
    select min(t.created_at) into oldest from (
      select a.created_at from public.auth_attempts a
       where a.kind = auth_wait_seconds.kind and a.email_hash = auth_wait_seconds.email_hash
         and a.created_at > now() - interval '1 hour'
       order by a.created_at desc limit 5
    ) t having count(*) >= 5;
    if oldest is null then
      select min(t.created_at) into oldest from (
        select a.created_at from public.auth_attempts a
         where a.kind = auth_wait_seconds.kind and a.ip_hash = auth_wait_seconds.ip_hash
           and a.created_at > now() - interval '1 hour'
         order by a.created_at desc limit 300
      ) t having count(*) >= 300;
    end if;
    return case when oldest is null then 0
                else greatest(1, ceil(extract(epoch from (oldest + interval '1 hour' - now())))::integer) end;
  end if;
  raise exception 'Not a valid attempt.' using errcode = '22023';
end;
$$;
