-- Lawdeck migration 62: group quiz extras, like Kahoot (founder, 2026-11-06; docs/specs/chat.md).
--   * Get ready: each question opens 3 seconds after the host moves on ("3, 2, 1"), and answers
--     before it opens are refused.
--   * Streaks: a right answer straight after other right answers earns 100 bonus points for each
--     one before it, up to 500 (so up to 1,500 points a question).
--   * Answer chart: once a question closes, how many players chose each answer.
-- Music and sounds are made in the browser and need nothing here.

alter table public.chat_quiz_answers drop constraint chat_quiz_answers_points_check;
alter table public.chat_quiz_answers add constraint chat_quiz_answers_points_check check (points between 0 and 1500);

-- How many right answers in a row a player has, ending with question `upto` (0 when none).
create function public.chat_quiz_streak(q uuid, person uuid, upto integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when upto < 0 then 0 else upto - coalesce(max(n) filter (where a.correct is not true), -1) end
    from generate_series(0, greatest(upto, 0)) n
    left join public.chat_quiz_answers a on a.quiz_id = q and a.owner_id = person and a.question = n;
$$;
revoke execute on function public.chat_quiz_streak(uuid, uuid, integer) from public, anon, authenticated;

create or replace function public.chat_quiz_next(q uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  z public.chat_quizzes;
begin
  select * into z from public.chat_quizzes where id = q;
  if z.id is null or z.host_id <> (select auth.uid()) or z.status = 'done' or not public.chat_quiz_member(q) then
    return 'not_allowed';
  end if;
  if z.current + 1 >= cardinality(z.question_ids) then
    update public.chat_quizzes set status = 'done', finished_at = now() where id = q;
    return 'done';
  end if;
  update public.chat_quizzes
     set status = 'live', current = z.current + 1, question_started_at = now() + interval '3 seconds'
   where id = q;
  return 'ok';
end;
$$;

create or replace function public.chat_quiz_answer(q uuid, question integer, choice integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  z public.chat_quizzes;
  right_choice integer;
  elapsed numeric;
  bonus integer := 0;
begin
  select * into z from public.chat_quizzes where id = q;
  if z.id is null or z.status <> 'live' or z.current <> question or not public.chat_quiz_member(q)
     or not exists (select 1 from public.chat_quiz_players p where p.quiz_id = q and p.owner_id = me) then
    return 'not_allowed';
  end if;
  elapsed := extract(epoch from now() - z.question_started_at);
  if elapsed < 0 then
    return 'early';
  end if;
  if elapsed > z.seconds then
    return 'late';
  end if;
  select k.correct_choice into right_choice from public.lesson_checkpoints k where k.id = z.question_ids[question + 1];
  if choice = right_choice then
    bonus := least(public.chat_quiz_streak(q, me, question - 1), 5) * 100;
  end if;
  insert into public.chat_quiz_answers (quiz_id, question, owner_id, choice, correct, points)
    values (q, question, me, choice, choice = right_choice,
            case when choice = right_choice then 500 + round(500 * (1 - elapsed / z.seconds))::int + bonus else 0 end)
    on conflict do nothing;
  return case when found then 'ok' else 'already' end;
end;
$$;

-- As in migration 61, plus: readyIn (seconds until the question opens; the question is hidden until
-- then), counts (answers per choice, once closed), myStreak and each player's streak.
create or replace function public.chat_quiz_state(q uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  z public.chat_quizzes;
  k public.lesson_checkpoints;
  players integer;
  answered integer;
  ready_s numeric := 0;
  left_s numeric := 0;
  closed boolean := false;
  shown integer;
  mine public.chat_quiz_answers;
begin
  select * into z from public.chat_quizzes where id = q;
  if z.id is null or not public.chat_quiz_member(q) then
    return null;
  end if;
  select count(*) into players from public.chat_quiz_players where quiz_id = q;
  if z.status = 'live' then
    select * into k from public.lesson_checkpoints where id = z.question_ids[z.current + 1];
    select count(*) into answered from public.chat_quiz_answers where quiz_id = q and question = z.current;
    ready_s := greatest(0, extract(epoch from z.question_started_at - now()));
    left_s := least(z.seconds, greatest(0, z.seconds - extract(epoch from now() - z.question_started_at)));
    closed := ready_s = 0 and (left_s = 0 or answered >= players);
    select * into mine from public.chat_quiz_answers where quiz_id = q and question = z.current and owner_id = me;
  end if;
  -- The last question whose results everyone may see.
  shown := case when z.status = 'done' or closed then z.current else z.current - 1 end;
  return jsonb_build_object(
    'id', z.id,
    'status', z.status,
    'topic', (select t.name from public.topics t where t.id = z.topic_id),
    'host', coalesce((select x.name from public.chat_people(array[z.host_id]) x limit 1), 'A Lawdeck student'),
    'isHost', z.host_id = me,
    'joined', exists (select 1 from public.chat_quiz_players p where p.quiz_id = q and p.owner_id = me),
    'players', players,
    'total', cardinality(z.question_ids),
    'current', z.current,
    'seconds', z.seconds,
    'readyIn', round(ready_s, 1),
    'secondsLeft', round(left_s, 1),
    'answered', coalesce(answered, 0),
    'question', case when z.status = 'live' and ready_s = 0 then jsonb_build_object('prompt', k.prompt, 'choices', k.choices) end,
    'closed', closed,
    'correctChoice', case when z.status = 'live' and closed then k.correct_choice end,
    'explanation', case when z.status = 'live' and closed then coalesce(k.explanation, k.answer) end,
    'counts', case when z.status = 'live' and closed then (
      select jsonb_agg((select count(*) from public.chat_quiz_answers a where a.quiz_id = q and a.question = z.current and a.choice = i) order by i)
        from generate_series(0, jsonb_array_length(k.choices) - 1) i) end,
    'myChoice', mine.choice,
    'myCorrect', case when closed then mine.correct end,
    'myPoints', case when closed then mine.points end,
    'myStreak', public.chat_quiz_streak(q, me, shown),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(x.name, 'Lawdeck student'), 'points', s.points, 'correct', s.correct,
                                          'streak', public.chat_quiz_streak(q, s.owner_id, shown), 'me', s.owner_id = me)
                       order by s.points desc, x.name)
        from (select p.owner_id, coalesce(sum(a.points) filter (where a.question <= shown), 0)::int as points,
                     count(*) filter (where a.correct and a.question <= shown)::int as correct
                from public.chat_quiz_players p
                left join public.chat_quiz_answers a on a.quiz_id = p.quiz_id and a.owner_id = p.owner_id
               where p.quiz_id = q
               group by p.owner_id) s
        left join lateral public.chat_people(array[s.owner_id]) x on true), '[]'::jsonb));
end;
$$;
