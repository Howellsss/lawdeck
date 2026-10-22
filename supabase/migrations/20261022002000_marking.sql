-- Lawdeck migration 20: "Mark my answer" (Phase 4, step 4e; PRD LN-08).
-- Students never read the rubrics table (migration 17). These functions give a signed-in person
-- only what marking needs, and only from approved guides:
-- 1. marking_questions: the approved exam-style questions to choose from (no marking points).
-- 2. marking_guide: one approved guide's question and marking points, for the server to mark an
--    answer and show the marking afterwards (PRD LN-08: "against a visible rubric").
-- 3. A marked answer counts as one question in the monthly allowance (founder, 2026-10-22).

create function public.marking_questions(course uuid default null)
returns table (id uuid, title text, question text, course_id uuid, course_name text, topic_name text, total_marks integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  return query
  select r.id, r.title, r.question, r.course_id, c.name, t.name,
         coalesce((select sum((p ->> 'marks')::integer) from jsonb_array_elements(r.criteria) p), 0)::integer
  from public.rubrics r
  join public.courses c on c.id = r.course_id
  left join public.topics t on t.id = r.topic_id
  where r.status = 'approved'
    and (course is null or r.course_id = course)
  order by c.position, t.position nulls last, r.title
  limit 500;
end;
$$;
revoke execute on function public.marking_questions(uuid) from public, anon;
grant execute on function public.marking_questions(uuid) to authenticated;

create function public.marking_guide(rubric uuid)
returns table (id uuid, title text, question text, criteria jsonb, course_id uuid, topic_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  return query
  select r.id, r.title, r.question, r.criteria, r.course_id, r.topic_id
  from public.rubrics r
  where r.id = rubric and r.status = 'approved';
end;
$$;
revoke execute on function public.marking_guide(uuid) from public, anon;
grant execute on function public.marking_guide(uuid) to authenticated;

-- Same functions as migration 18, with the new 'marking' kind added.
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
  if kind is null or kind not in ('explain', 'route', 'transcribe', 'practice', 'brief', 'marking') then
    raise exception 'Unknown kind of AI call.' using errcode = '22023';
  end if;
  insert into public.usage_events (owner_id, kind, model, tokens_in, tokens_out, cost_usd, duration_ms)
  values ((select auth.uid()), kind, left(model, 80), greatest(tokens_in, 0), greatest(tokens_out, 0),
          greatest(cost_usd, 0), greatest(duration_ms, 0));
end;
$$;

create or replace function public.question_allowance()
returns table (used integer, monthly_limit integer, unlimited boolean)
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
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select pr.plan_id into own_plan from public.profiles pr where pr.id = me;
  if own_plan is null then
    select p.id into own_plan from public.plans p where p.name = 'Free';
  end if;
  select p.monthly_message_limit into plan_limit from public.plans p where p.id = own_plan;
  return query
  select
    (select count(*)::integer from public.usage_events e
      where e.owner_id = me and e.kind in ('explain', 'practice', 'brief', 'marking') and e.created_at >= month_start),
    coalesce(plan_limit, 0),
    public.is_reviewer() or (own_plan is not null and plan_limit is null);
end;
$$;
