-- Lawdeck migration 38: reading answers aloud (founder, 2026-10-28).
-- 1. record_ai_usage accepts one more kind, 'speech': each part of an answer read aloud by the
--    voice service (model = the voice, tokens_in = characters read, with its cost and time).
--    Speech never counts towards the monthly question allowance.
-- 2. speech_used_today(): how many characters the signed-in person has heard today (Lagos time),
--    for the daily reading limit the server checks; reviewers and admins are not limited.
-- Functions only: no table changes.

create or replace function public.record_ai_usage(
  kind text,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric,
  duration_ms integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if kind is null or kind not in ('explain', 'route', 'transcribe', 'practice', 'brief', 'marking', 'draft', 'draft_pick', 'speech') then
    raise exception 'Unknown kind of AI call.' using errcode = '22023';
  end if;
  insert into public.usage_events (owner_id, kind, model, tokens_in, tokens_out, cost_usd, duration_ms)
  values ((select auth.uid()), kind, left(model, 80), greatest(tokens_in, 0), greatest(tokens_out, 0),
          greatest(cost_usd, 0), greatest(duration_ms, 0));
end;
$$;

create function public.speech_used_today()
returns table (used integer, unlimited boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  day_start timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  return query
  select
    coalesce((select sum(e.tokens_in)::integer from public.usage_events e
               where e.owner_id = me and e.kind = 'speech' and e.created_at >= day_start), 0),
    public.is_reviewer();
end;
$$;
revoke execute on function public.speech_used_today() from public, anon;
grant execute on function public.speech_used_today() to authenticated;
