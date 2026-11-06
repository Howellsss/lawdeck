-- Lawdeck migration 61: group quiz in study groups, like Kahoot (founder, 2026-11-06;
-- docs/specs/chat.md). A member hosts a quiz on a topic; the questions are the multiple-choice
-- recall questions of that topic's approved lesson (reviewed content, no AI cost). Everyone joins,
-- the host starts it, each question has a timer, faster correct answers score more, and a
-- leaderboard ends it. The right answer is kept in the database until the question closes. Every
-- read and change goes through the functions below; nobody touches the tables directly.

create table public.chat_quizzes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  host_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  question_ids uuid[] not null check (cardinality(question_ids) between 3 and 10),
  seconds integer not null check (seconds between 10 and 60),
  status text not null default 'lobby' check (status in ('lobby', 'live', 'done')),
  current integer not null default -1,
  question_started_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.chat_quizzes enable row level security;
create index chat_quizzes_group_idx on public.chat_quizzes (group_id, created_at desc);

create table public.chat_quiz_players (
  quiz_id uuid not null references public.chat_quizzes (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (quiz_id, owner_id)
);
alter table public.chat_quiz_players enable row level security;

create table public.chat_quiz_answers (
  quiz_id uuid not null references public.chat_quizzes (id) on delete cascade,
  question integer not null check (question between 0 and 9),
  owner_id uuid not null references auth.users (id) on delete cascade,
  choice integer not null check (choice between 0 and 5),
  correct boolean not null,
  points integer not null check (points between 0 and 1000),
  answered_at timestamptz not null default now(),
  primary key (quiz_id, question, owner_id)
);
alter table public.chat_quiz_answers enable row level security;

-- No direct access: only the functions below read and change quizzes.
revoke all on public.chat_quizzes, public.chat_quiz_players, public.chat_quiz_answers from anon, authenticated;

-- A quiz is for the members of its study group only.
create function public.chat_quiz_member(q uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.chat_quizzes z where z.id = q and public.chat_group_visible(z.group_id));
$$;
revoke execute on function public.chat_quiz_member(uuid) from public, anon, authenticated;

-- Topics a quiz can be on: an approved lesson with at least 3 multiple-choice questions.
create function public.chat_quiz_topics()
returns table (topic_id uuid, course text, topic text, questions bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, c.name, t.name, count(k.id)
    from public.topics t
    join public.courses c on c.id = t.course_id
    join public.topic_lessons l on l.topic_id = t.id and l.status = 'approved'
    join public.lesson_checkpoints k on k.lesson_id = l.id and k.kind = 'mcq'
   where public.chat_scope() is not null
   group by t.id, c.name, c.position, t.name, t.position
  having count(k.id) >= 3
   order by c.position, t.position;
$$;
revoke execute on function public.chat_quiz_topics() from public, anon;
grant execute on function public.chat_quiz_topics() to authenticated;

-- Hosting: a member of a study group picks a topic, up to 10 questions and 10 to 60 seconds each.
-- One quiz at a time per group (a quiz left open for 3 hours counts as finished). The group gets a
-- message saying a quiz is waiting in the Quiz tab.
create function public.chat_quiz_create(g uuid, topic uuid, how_many integer, secs integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  picked uuid[];
  topic_name text;
  new_id uuid;
begin
  if not exists (select 1 from public.chat_groups where id = g and kind = 'study') or not public.chat_group_visible(g) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if how_many not between 3 and 10 or secs not between 10 and 60 then
    raise exception 'bad_settings' using errcode = '23514';
  end if;
  update public.chat_quizzes set status = 'done', finished_at = now()
   where group_id = g and status <> 'done' and created_at < now() - interval '3 hours';
  if exists (select 1 from public.chat_quizzes where group_id = g and status <> 'done') then
    raise exception 'quiz_running' using errcode = '23514';
  end if;
  select array(
    select k.id from public.lesson_checkpoints k
      join public.topic_lessons l on l.id = k.lesson_id and l.status = 'approved'
     where l.topic_id = topic and k.kind = 'mcq'
     order by random() limit how_many)
    into picked;
  if cardinality(picked) < 3 then
    raise exception 'too_few_questions' using errcode = '23514';
  end if;
  select name into topic_name from public.topics where id = topic;
  insert into public.chat_quizzes (group_id, host_id, topic_id, question_ids, seconds)
    values (g, me, topic, picked, secs) returning id into new_id;
  insert into public.chat_quiz_players (quiz_id, owner_id) values (new_id, me);
  insert into public.chat_messages (group_id, owner_id, body)
    values (g, me, '🎯 Group quiz on **' || replace(replace(topic_name, '*', ''), '_', ' ') || '** (' || cardinality(picked) || ' questions). Open the **Quiz** tab to join.');
  return new_id;
end;
$$;
revoke execute on function public.chat_quiz_create(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.chat_quiz_create(uuid, uuid, integer, integer) to authenticated;

create function public.chat_quiz_join(q uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.chat_quiz_member(q) or not exists (select 1 from public.chat_quizzes where id = q and status <> 'done') then
    return 'not_allowed';
  end if;
  insert into public.chat_quiz_players (quiz_id, owner_id) values (q, (select auth.uid())) on conflict do nothing;
  return 'ok';
end;
$$;
revoke execute on function public.chat_quiz_join(uuid) from public, anon;
grant execute on function public.chat_quiz_join(uuid) to authenticated;

-- The host moves the quiz on: start (from the lobby), next question, or finish after the last.
create function public.chat_quiz_next(q uuid)
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
     set status = 'live', current = z.current + 1, question_started_at = now()
   where id = q;
  return 'ok';
end;
$$;
revoke execute on function public.chat_quiz_next(uuid) from public, anon;
grant execute on function public.chat_quiz_next(uuid) to authenticated;

-- The host, or the group's creator, can end a quiz early.
create function public.chat_quiz_end(q uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_quizzes z set status = 'done', finished_at = now()
   where z.id = q and z.status <> 'done' and public.chat_quiz_member(q)
     and (z.host_id = (select auth.uid()) or exists (select 1 from public.chat_groups g where g.id = z.group_id and g.owner_id = (select auth.uid())));
  return case when found then 'ok' else 'not_allowed' end;
end;
$$;
revoke execute on function public.chat_quiz_end(uuid) from public, anon;
grant execute on function public.chat_quiz_end(uuid) to authenticated;

-- Answering the open question, once, before time runs out. A correct answer scores 500 to 1000
-- points: faster answers score more. The right answer is not returned.
create function public.chat_quiz_answer(q uuid, question integer, choice integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  z public.chat_quizzes;
  right_choice integer;
  elapsed numeric;
begin
  select * into z from public.chat_quizzes where id = q;
  if z.id is null or z.status <> 'live' or z.current <> question or not public.chat_quiz_member(q)
     or not exists (select 1 from public.chat_quiz_players p where p.quiz_id = q and p.owner_id = (select auth.uid())) then
    return 'not_allowed';
  end if;
  elapsed := extract(epoch from now() - z.question_started_at);
  if elapsed > z.seconds then
    return 'late';
  end if;
  select k.correct_choice into right_choice from public.lesson_checkpoints k where k.id = z.question_ids[question + 1];
  insert into public.chat_quiz_answers (quiz_id, question, owner_id, choice, correct, points)
    values (q, question, (select auth.uid()), choice, choice = right_choice,
            case when choice = right_choice then 500 + round(500 * (1 - elapsed / z.seconds))::int else 0 end)
    on conflict do nothing;
  return case when found then 'ok' else 'already' end;
end;
$$;
revoke execute on function public.chat_quiz_answer(uuid, integer, integer) from public, anon;
grant execute on function public.chat_quiz_answer(uuid, integer, integer) to authenticated;

-- Everything a player's screen needs, checked about once a second while a quiz is on: where the
-- quiz is, the open question (the right answer and explanation only once it has closed: time up or
-- everyone answered), the caller's own answer, and the leaderboard (names and points only).
create function public.chat_quiz_state(q uuid)
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
  left_s numeric := 0;
  closed boolean := false;
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
    left_s := greatest(0, z.seconds - extract(epoch from now() - z.question_started_at));
    closed := left_s = 0 or answered >= players;
    select * into mine from public.chat_quiz_answers where quiz_id = q and question = z.current and owner_id = me;
  end if;
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
    'secondsLeft', round(left_s, 1),
    'answered', coalesce(answered, 0),
    'question', case when z.status = 'live' then jsonb_build_object('prompt', k.prompt, 'choices', k.choices) end,
    'closed', closed,
    'correctChoice', case when z.status = 'live' and closed then k.correct_choice end,
    'explanation', case when z.status = 'live' and closed then coalesce(k.explanation, k.answer) end,
    'myChoice', mine.choice,
    'myCorrect', case when closed then mine.correct end,
    'myPoints', case when closed then mine.points end,
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(x.name, 'Lawdeck student'), 'points', s.points, 'correct', s.correct, 'me', s.owner_id = me)
                       order by s.points desc, x.name)
        from (select p.owner_id, coalesce(sum(a.points) filter (where a.question < z.current or closed or z.status = 'done'), 0)::int as points,
                     count(*) filter (where a.correct and (a.question < z.current or closed or z.status = 'done'))::int as correct
                from public.chat_quiz_players p
                left join public.chat_quiz_answers a on a.quiz_id = p.quiz_id and a.owner_id = p.owner_id
               where p.quiz_id = q
               group by p.owner_id) s
        left join lateral public.chat_people(array[s.owner_id]) x on true), '[]'::jsonb));
end;
$$;
revoke execute on function public.chat_quiz_state(uuid) from public, anon;
grant execute on function public.chat_quiz_state(uuid) to authenticated;

-- The group's latest quiz (open, or finished in the last day), for its Quiz tab.
create function public.chat_quiz_latest(g uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select z.id from public.chat_quizzes z
   where z.group_id = g and public.chat_group_visible(g)
     and (z.status <> 'done' or z.finished_at > now() - interval '1 day')
   order by z.created_at desc
   limit 1;
$$;
revoke execute on function public.chat_quiz_latest(uuid) from public, anon;
grant execute on function public.chat_quiz_latest(uuid) to authenticated;
