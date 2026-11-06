-- Permission tests at database level: voice notes (migration 60). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a5c60001-0000-0000-0000-000000000001', 'ada60@test.invalid', '{"full_name": "Ada Sixty"}'),
  ('a5c60005-0000-0000-0000-000000000005', 'admin60@test.invalid', '{"full_name": "Admin Sixty"}');
update public.profiles set role = 'admin' where id = 'a5c60005-0000-0000-0000-000000000005';
update public.pilot_settings set invite_only = false;
update public.chat_settings set open_to_students = true;

select test.as_user('a5c60001-0000-0000-0000-000000000001');
insert into public.chat_verifications (kind, campus_key, id_number) values ('student', 'lagos', 'NLS/60/1');
reset role;
select test.as_user('a5c60005-0000-0000-0000-000000000005');
update public.chat_verifications set status = 'approved' where id_number = 'NLS/60/1';
reset role;

select test.as_user('a5c60001-0000-0000-0000-000000000001');
insert into public.chat_members default values;
select public.chat_create_study_group('Voice squad') as squad \gset
reset role;
create temporary table g60 as select key, id from public.chat_groups where key in ('lagos', :'squad');
grant select on g60 to authenticated;

-- A voice note as the app sends it: the sender's own folder in the group, with its length.
create function pg_temp.voice(g uuid, ext text, size bigint, secs numeric) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object(
    'path', g || '/a5c60001-0000-0000-0000-000000000001/00000000-0000-4000-8000-0000000060' || lpad((floor(random() * 99))::text, 2, '0') || '.' || ext,
    'name', 'Voice note', 'kind', 'voice', 'size', size, 'seconds', secs));
$$;
grant execute on function pg_temp.voice(uuid, text, bigint, numeric) to authenticated;

select test.as_user('a5c60001-0000-0000-0000-000000000001');
insert into public.chat_messages (group_id, body, attachments) select id, '', pg_temp.voice(id, 'webm', 48000, 12.5) from g60 where key = :'squad';
select test.check((select count(*) from public.chat_messages where attachments @> '[{"kind": "voice"}]') = 1, 'a voice note is posted in a study group');
insert into public.chat_messages (group_id, body, attachments) select id, 'From my iPhone', pg_temp.voice(id, 'm4a', 90000, 30) from g60 where key = :'squad';
select test.check((select count(*) from public.chat_messages where attachments @> '[{"kind": "voice"}]') = 2, 'iPhone recordings (MP4 audio) work too');
select test.refused($$insert into public.chat_messages (group_id, body, attachments) select id, '', pg_temp.voice(id, 'webm', 48000, 12) from g60 where key = 'lagos'$$,
  'but not in a campus group');
select test.refused($$insert into public.chat_messages (group_id, body, attachments) select id, '', pg_temp.voice(id, 'webm', 5242881, 60) from g60 where key = (select key from g60 where key like 's-%')$$,
  'a voice note is at most 5 MB');
select test.refused($$insert into public.chat_messages (group_id, body, attachments) select id, '', pg_temp.voice(id, 'webm', 48000, 121) from g60 where key like 's-%'$$,
  'and at most 2 minutes');
select test.refused($$insert into public.chat_messages (group_id, body, attachments) select id, '', pg_temp.voice(id, 'pdf', 48000, 10) from g60 where key like 's-%'$$,
  'a voice note must be an audio file');
select test.refused($$insert into public.chat_messages (group_id, body, attachments) select id, '', pg_temp.voice(id, 'webm', 48000, 10) || pg_temp.voice(id, 'ogg', 48000, 10) from g60 where key like 's-%'$$,
  'one voice note per message');
select test.refused($$insert into public.chat_messages (group_id, body, attachments) select id, '', jsonb_set(pg_temp.voice(id, 'webm', 48000, 10), '{0,kind}', '"pdf"') from g60 where key like 's-%'$$,
  'audio cannot be passed off as a document');
reset role;

update public.chat_settings set open_to_students = false;
