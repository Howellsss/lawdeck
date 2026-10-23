-- Lawdeck migration 29: limits on sign-in, sign-up, password-reset and resend attempts (Phase 7,
-- step 7c; Engineering Rules C-04, K-02). Approved by the founder, 2026-10-23.
-- Lawdeck's server asks before each attempt whether it may go ahead, and records it:
--   sign-in: 5 wrong passwords for one email in 15 minutes pauses sign-in for that email;
--   sign-up, password reset, resend: 5 per email an hour, and 20 per internet address an hour.
-- Only scrambled (SHA-256) forms of the email and internet address are kept, never the real ones,
-- and only for a day. Supabase's own limits stay on underneath.

create table public.auth_attempts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('sign_in_failed', 'sign_up', 'reset', 'resend')),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.auth_attempts enable row level security;
-- No policies and no grants: nobody reads or writes it directly, only through the functions below.
revoke all on public.auth_attempts from anon, authenticated;
create index auth_attempts_email_idx on public.auth_attempts (kind, email_hash, created_at desc);
create index auth_attempts_ip_idx on public.auth_attempts (kind, ip_hash, created_at desc);
create index auth_attempts_created_idx on public.auth_attempts (created_at);

-- How many seconds the person must wait before this kind of attempt (0: go ahead).
create function public.auth_wait_seconds(kind text, email_hash text, ip_hash text)
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
         order by a.created_at desc limit 20
      ) t having count(*) >= 20;
    end if;
    return case when oldest is null then 0
                else greatest(1, ceil(extract(epoch from (oldest + interval '1 hour' - now())))::integer) end;
  end if;
  raise exception 'Not a valid attempt.' using errcode = '22023';
end;
$$;

-- Records an attempt (a wrong password, or a sign-up, reset or resend request). Rows older than
-- a day are removed as new ones arrive, so the table stays small.
create function public.record_auth_attempt(kind text, email_hash text, ip_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if kind not in ('sign_in_failed', 'sign_up', 'reset', 'resend') then
    raise exception 'Not a valid attempt.' using errcode = '22023';
  end if;
  delete from public.auth_attempts where created_at < now() - interval '1 day';
  insert into public.auth_attempts (kind, email_hash, ip_hash)
  values (record_auth_attempt.kind, record_auth_attempt.email_hash, record_auth_attempt.ip_hash);
end;
$$;

revoke all on function public.auth_wait_seconds(text, text, text), public.record_auth_attempt(text, text, text) from public;
grant execute on function public.auth_wait_seconds(text, text, text), public.record_auth_attempt(text, text, text)
  to anon, authenticated;
