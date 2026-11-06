-- Lawdeck migration 60: voice notes in study groups (founder, 2026-11-06; docs/specs/chat.md).
-- Founder's decisions: voice notes only in private study groups (the word filter can't hear audio,
-- so Report and Hide are the safeguards), up to 2 minutes and 5 MB each. They are stored like other
-- chat files (private, per group); the app checks each recording's real type before posting.

-- 1. The chat file store also takes audio (WebM, Ogg or MP4 audio, as phones record it).
update storage.buckets
   set allowed_mime_types = array[
     'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg',
     'audio/webm', 'audio/ogg', 'audio/mp4']
 where id = 'chat-files';

-- 2. Messages may carry one voice note (kind 'voice', with its length in seconds), only in a study group.
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
  if btrim(new.body) = '' and jsonb_array_length(new.attachments) = 0 then
    raise exception 'A message needs words or a file.' using errcode = '23514';
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
