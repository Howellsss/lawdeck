-- Lawdeck migration 63: study together in chat (founder, 2026-11-06; docs/specs/chat.md, step 4d).
-- Founder's decisions: lesson cards can be shared in any chat group the student can see (campus
-- groups and study groups); "This week's topic" is for study groups only and is set by the group's
-- creator. A card points to a topic, never copies the lesson's text, and only topics with an approved
-- lesson can be shared. Every change goes through the functions below.

-- 1. A message may carry a lesson card (the topic it points to). Set only by chat_share_lesson.
alter table public.chat_messages add column lesson_topic_id uuid references public.topics (id) on delete set null;

-- 2. A study group's "This week's topic": the topic, who set it and when.
alter table public.chat_groups add column week_topic_id uuid references public.topics (id) on delete set null;
alter table public.chat_groups add column week_topic_by uuid references auth.users (id) on delete set null;
alter table public.chat_groups add column week_topic_at timestamptz;
alter table public.chat_groups add constraint chat_groups_week_topic_study check (week_topic_id is null or kind = 'study');

-- 3. A topic can be shared when it has an approved lesson (the current version).
create function public.chat_lesson_shareable(topic uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.topic_lessons l where l.topic_id = topic and l.status = 'approved' and l.replaced_by is null);
$$;
revoke execute on function public.chat_lesson_shareable(uuid) from public, anon, authenticated;

-- 4. The messages check also accepts a lesson card with no words (the card is the message).
create or replace function public.chat_messages_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f jsonb;
  names text := '';
  voices int := 0;
begin
  if btrim(new.body) = '' and jsonb_array_length(new.attachments) = 0 and new.lesson_topic_id is null then
    raise exception 'A message needs words or a file.' using errcode = '23514';
  end if;
  if new.lesson_topic_id is not null and (tg_op = 'INSERT' or new.lesson_topic_id is distinct from old.lesson_topic_id)
     and not public.chat_lesson_shareable(new.lesson_topic_id) then
    raise exception 'lesson_not_shareable' using errcode = '23514';
  end if;
  for f in select * from jsonb_array_elements(new.attachments) loop
    if jsonb_typeof(f) <> 'object'
       or coalesce(f ->> 'path', '') !~ ('^' || new.group_id::text || '/' || new.owner_id::text || '/[0-9a-f-]{36}\.(pdf|docx|png|jpg|webm|ogg|m4a)$')
       or coalesce(f ->> 'kind', '') not in ('pdf', 'docx', 'png', 'jpeg', 'voice')
       or char_length(coalesce(f ->> 'name', '')) not between 1 and 200
       or coalesce((f ->> 'size')::bigint, 0) not between 1 and 26214400 then
      raise exception 'That file could not be attached.' using errcode = '23514';
    end if;
    if f ->> 'kind' = 'voice' then
      voices := voices + 1;
      if (f ->> 'path') !~ '\.(webm|ogg|m4a)$'
         or (f ->> 'size')::bigint > 5242880
         or coalesce((f ->> 'seconds')::numeric, 0) not between 1 and 120
         or not exists (select 1 from public.chat_groups g where g.id = new.group_id and g.kind = 'study') then
        raise exception 'voice_note' using errcode = '23514';
      end if;
    elsif (f ->> 'path') ~ '\.(webm|ogg|m4a)$' then
      raise exception 'That file could not be attached.' using errcode = '23514';
    else
      names := names || ' ' || (f ->> 'name');
    end if;
  end loop;
  if voices > 1 then
    raise exception 'voice_note' using errcode = '23514';
  end if;
  if exists (select 1 from unnest(new.hashtags) h where h !~ '^[a-z0-9_]{1,40}$') then
    raise exception 'A hashtag can use letters, numbers and _ only.' using errcode = '23514';
  end if;
  if public.chat_blocked_word(new.body || names) is not null then
    raise exception 'blocked_word' using errcode = '23514';
  end if;
  if public.chat_has_contact_details(new.body || names) then
    raise exception 'contact_details' using errcode = '23514';
  end if;
  if (select count(*) from public.chat_messages
       where owner_id = new.owner_id and created_at > now() - interval '1 minute') >= 8
     or (select count(*) from public.chat_messages
       where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 300 then
    raise exception 'post_limit' using errcode = '23514';
  end if;
  new.created_at := now();
  return new;
end;
$$;

-- 5. The topics that can be shared, by course (any chat user).
create function public.chat_lesson_topics()
returns table (topic_id uuid, course text, topic text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, c.name, t.name
    from public.topics t
    join public.courses c on c.id = t.course_id
   where public.chat_scope() is not null
     and public.chat_lesson_shareable(t.id)
   order by c.position, t.position, t.name;
$$;
revoke execute on function public.chat_lesson_topics() from public, anon;
grant execute on function public.chat_lesson_topics() to authenticated;

-- 6. What a card shows: the topic, its course, the lesson's title and whether a reviewer has read it
-- in full. Only for topics the reader's messages point to; never the lesson's text.
create function public.chat_lesson_cards(topics uuid[])
returns table (topic_id uuid, course text, topic text, lesson_title text, bulk_approved boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, c.name, t.name, l.title, coalesce(l.bulk_approved, false)
    from public.topics t
    join public.courses c on c.id = t.course_id
    join public.topic_lessons l on l.topic_id = t.id and l.status = 'approved' and l.replaced_by is null
   where public.chat_scope() is not null
     and t.id = any (topics)
     and cardinality(topics) <= 100;
$$;
revoke execute on function public.chat_lesson_cards(uuid[]) from public, anon;
grant execute on function public.chat_lesson_cards(uuid[]) to authenticated;

-- 7. Sharing a lesson card in a group the student can see, with an optional note. The note goes
-- through the same word filter, contact-details check and posting limit as any message.
create function public.chat_share_lesson(g uuid, topic uuid, note text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  new_id uuid;
begin
  if me is null or not public.chat_group_visible(g)
     or not exists (select 1 from public.chat_members m where m.owner_id = me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(coalesce(note, '')) > 500 then
    raise exception 'note_too_long' using errcode = '23514';
  end if;
  insert into public.chat_messages (group_id, owner_id, body, lesson_topic_id)
    values (g, me, btrim(coalesce(note, '')), topic)
    returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.chat_share_lesson(uuid, uuid, text) from public, anon;
grant execute on function public.chat_share_lesson(uuid, uuid, text) to authenticated;

-- 8. Setting or clearing a study group's "This week's topic": its creator only. Setting it also
-- posts the lesson card in the group, so everyone sees it.
create function public.chat_set_week_topic(g uuid, topic uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not public.chat_group_visible(g)
     or not exists (select 1 from public.chat_groups where id = g and kind = 'study' and owner_id = me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if topic is null then
    update public.chat_groups set week_topic_id = null, week_topic_by = null, week_topic_at = null where id = g;
    return 'cleared';
  end if;
  if not public.chat_lesson_shareable(topic) then
    raise exception 'lesson_not_shareable' using errcode = '23514';
  end if;
  update public.chat_groups set week_topic_id = topic, week_topic_by = me, week_topic_at = now() where id = g;
  insert into public.chat_messages (group_id, owner_id, body, lesson_topic_id)
    values (g, me, '📌 This week''s topic', topic);
  return 'set';
end;
$$;
revoke execute on function public.chat_set_week_topic(uuid, uuid) from public, anon;
grant execute on function public.chat_set_week_topic(uuid, uuid) to authenticated;
