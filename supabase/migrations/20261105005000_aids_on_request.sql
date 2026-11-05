-- Lawdeck migration 50: memory aids and stories made on request (Remembrance Phase 2c; founder's
-- brief: "Allow students to generate alternative mnemonics ... request another version of a
-- story"). Needs migration 49.
-- 1. A new kind of AI call, 'memory_aid', that counts as one question (founder, 2026-11-05).
-- 2. A student can save an aid made for them; it is marked as such.

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
  if kind is null or kind not in ('explain', 'route', 'transcribe', 'practice', 'brief', 'marking', 'draft', 'draft_pick', 'speech', 'talk_chat', 'memory_aid') then
    raise exception 'Unknown kind of AI call.' using errcode = '22023';
  end if;
  insert into public.usage_events (owner_id, kind, model, tokens_in, tokens_out, cost_usd, duration_ms)
  values ((select auth.uid()), kind, left(model, 80), greatest(tokens_in, 0), greatest(tokens_out, 0),
          greatest(cost_usd, 0), greatest(duration_ms, 0));
end;
$$;

-- The allowance, unchanged except that 'memory_aid' counts like a question.
create or replace function public.question_allowance()
returns table (
  used integer,
  monthly_limit integer,
  unlimited boolean,
  window_used integer,
  window_limit integer,
  window_resets_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  own_plan uuid;
  plan_limit integer;
  settings public.pilot_settings;
  staff boolean;
  access boolean;
  window_start timestamptz;
  oldest timestamptz;
  in_window integer;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select pr.plan_id into own_plan from public.profiles pr where pr.id = me;
  if own_plan is null then
    select p.id into own_plan from public.plans p where p.name = 'Free';
  end if;
  select p.monthly_message_limit into plan_limit from public.plans p where p.id = own_plan;
  select * into settings from public.pilot_settings s where s.id;
  staff := public.is_reviewer();
  access := public.has_pilot_access();

  -- The monthly cap applies to students on any plan, including unlimited ones.
  if not staff and settings.monthly_question_cap is not null then
    plan_limit := least(coalesce(plan_limit, settings.monthly_question_cap), settings.monthly_question_cap);
  end if;

  if not staff and settings.burst_limit is not null then
    window_start := now() - make_interval(hours => settings.burst_hours);
    select count(*)::integer, min(e.created_at) into in_window, oldest
      from public.usage_events e
     where e.owner_id = me and e.kind in ('explain', 'practice', 'brief', 'marking', 'draft', 'memory_aid')
       and e.created_at >= window_start;
  end if;

  return query
  select
    (select count(*)::integer from public.usage_events e
      where e.owner_id = me and e.kind in ('explain', 'practice', 'brief', 'marking', 'draft', 'memory_aid') and e.created_at >= month_start),
    case when access then coalesce(plan_limit, 0) else 0 end,
    staff or (access and own_plan is not null and plan_limit is null),
    in_window,
    case when staff then null else settings.burst_limit end,
    case when in_window is not null and in_window >= settings.burst_limit
      then oldest + make_interval(hours => settings.burst_hours) end;
end;
$$;
revoke execute on function public.question_allowance() from public, anon;
grant execute on function public.question_allowance() to authenticated;

-- Saving an aid made for the student: their own record, marked "made for me". An aid from a lesson
-- is still copied from the aid itself, whatever the student sends.
alter table public.saved_memory_aids add column made_for_me boolean not null default false;
grant insert (topic_id, kind, title, device, items, explanation) on public.saved_memory_aids to authenticated;

create or replace function public.saved_memory_aids_copy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a record;
begin
  if (select count(*) from public.saved_memory_aids where owner_id = new.owner_id) >= 500 then
    raise exception 'You have saved 500 memory aids. Remove some to save more.' using errcode = '23514';
  end if;
  if new.aid_id is null then
    -- Made for the student on request: kept as sent, for a topic they can see.
    if not exists (select 1 from public.topics t where t.id = new.topic_id) then
      raise exception 'That topic could not be found.' using errcode = '23503';
    end if;
    new.made_for_me := true;
    return new;
  end if;
  select m.kind, m.title, m.device, m.items, m.explanation, l.topic_id into a
    from public.lesson_memory_aids m
    join public.lesson_extras e on e.id = m.extras_id
    join public.topic_lessons l on l.id = e.lesson_id
   where m.id = new.aid_id;
  if not found then
    raise exception 'That memory aid could not be found.' using errcode = '23503';
  end if;
  new.kind := a.kind;
  new.title := a.title;
  new.device := a.device;
  new.items := a.items;
  new.explanation := a.explanation;
  new.topic_id := a.topic_id;
  new.made_for_me := false;
  return new;
end;
$$;
revoke execute on function public.saved_memory_aids_copy() from public, anon, authenticated;
