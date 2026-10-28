-- Lawdeck migration 40: free small talk in voice mode (founder, 2026-10-28).
-- record_ai_usage accepts one more kind, 'talk_chat': a voice-mode reply that used no library
-- passage (a greeting, thanks, checking what the student wants). It is logged with its cost but
-- never counts towards the monthly question allowance; a reply that teaches from the library is
-- still recorded as 'explain' and counts. Functions only: no table changes.

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
  if kind is null or kind not in ('explain', 'route', 'transcribe', 'practice', 'brief', 'marking', 'draft', 'draft_pick', 'speech', 'talk_chat') then
    raise exception 'Unknown kind of AI call.' using errcode = '22023';
  end if;
  insert into public.usage_events (owner_id, kind, model, tokens_in, tokens_out, cost_usd, duration_ms)
  values ((select auth.uid()), kind, left(model, 80), greatest(tokens_in, 0), greatest(tokens_out, 0),
          greatest(cost_usd, 0), greatest(duration_ms, 0));
end;
$$;
