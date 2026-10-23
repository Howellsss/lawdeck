-- Lawdeck migration 31: early warning of unusual access (Phase 7, step 7e; Engineering Rules P-03).
-- Approved by the founder, 2026-10-23.
-- 1. download_events: when each Word download or export happened, and for whom. No file contents.
--    Written only through record_download(), for the signed-in person; nobody reads it directly.
-- 2. unusual_activity(): counts for the last hour (failed sign-ins, sign-ups, the most downloads and
--    questions by any one account). Only the marked admin job (service key) may run it; it returns
--    counts only, never who. The hourly GitHub job compares them with its limits and alerts the founder.

create table public.download_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('document_docx', 'study_export')),
  created_at timestamptz not null default now()
);
alter table public.download_events enable row level security;
-- No policies and no grants: nobody reads or writes it directly.
revoke all on public.download_events from anon, authenticated;
create index download_events_created_idx on public.download_events (created_at);

-- Records a download for the signed-in person, and clears entries older than 30 days.
create function public.record_download(kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if kind is null or kind not in ('document_docx', 'study_export') then
    raise exception 'Unknown kind of download.' using errcode = '22023';
  end if;
  insert into public.download_events (owner_id, kind) values ((select auth.uid()), kind);
  delete from public.download_events d where d.created_at < now() - interval '30 days';
end;
$$;
revoke execute on function public.record_download(text) from public, anon;
grant execute on function public.record_download(text) to authenticated;

-- Counts for the last `minutes` minutes (5 to 1440). Counts only: no ids, emails or addresses.
create function public.unusual_activity(minutes integer default 60)
returns table (metric text, value integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz;
begin
  if current_setting('role', true) is distinct from 'service_role' then
    raise exception 'Admin job only.' using errcode = '42501';
  end if;
  if minutes is null or minutes < 5 or minutes > 1440 then
    raise exception 'Minutes must be between 5 and 1440.' using errcode = '22023';
  end if;
  since := now() - make_interval(mins => minutes);
  return query
  select 'failed_sign_ins', (select count(*)::integer from public.auth_attempts a
                             where a.kind = 'sign_in_failed' and a.created_at >= since)
  union all
  select 'emails_with_5_failed_sign_ins', (select count(*)::integer from (
            select a.email_hash from public.auth_attempts a
             where a.kind = 'sign_in_failed' and a.created_at >= since
             group by a.email_hash having count(*) >= 5) x)
  union all
  select 'sign_ups', (select count(*)::integer from public.auth_attempts a
                      where a.kind = 'sign_up' and a.created_at >= since)
  union all
  select 'most_downloads_by_one_account', (select coalesce(max(n), 0)::integer from (
            select count(*) n from public.download_events d
             where d.created_at >= since group by d.owner_id) x)
  union all
  select 'most_questions_by_one_account', (select coalesce(max(n), 0)::integer from (
            select count(*) n from public.usage_events e
             where e.kind in ('explain', 'practice', 'brief', 'marking', 'draft') and e.created_at >= since
             group by e.owner_id) x);
end;
$$;
revoke execute on function public.unusual_activity(integer) from public, anon, authenticated;
grant execute on function public.unusual_activity(integer) to service_role;
