-- Permission tests at database level: study together, lesson cards and "This week's topic"
-- (migration 63). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a5c63001-0000-0000-0000-000000000001', 'ada63@test.invalid', '{"full_name": "Ada Sixtythree"}'),
  ('a5c63002-0000-0000-0000-000000000002', 'bola63@test.invalid', '{"full_name": "Bola Sixtythree"}'),
  ('a5c63003-0000-0000-0000-000000000003', 'chi63@test.invalid', '{"full_name": "Chi Sixtythree"}'),
  ('a5c63004-0000-0000-0000-000000000004', 'dayo63@test.invalid', '{"full_name": "Dayo Sixtythree"}');
update public.pilot_settings set invite_only = false;
update public.chat_settings set open_to_students = true;

-- Three topics: one with an approved lesson, one bulk-approved, one with a lesson waiting for review.
insert into public.courses (id, slug, name) values ('a5c63100-0000-0000-0000-000000000000', 'together-course-63', 'Together Course 63');
insert into public.topics (id, course_id, slug, name) values
  ('a5c63101-0000-0000-0000-000000000000', 'a5c63100-0000-0000-0000-000000000000', 'read-topic-63', 'Read topic 63'),
  ('a5c63102-0000-0000-0000-000000000000', 'a5c63100-0000-0000-0000-000000000000', 'bulk-topic-63', 'Bulk topic 63'),
  ('a5c63103-0000-0000-0000-000000000000', 'a5c63100-0000-0000-0000-000000000000', 'draft-topic-63', 'Draft topic 63');
insert into public.topic_lessons (topic_id, title, content, status, bulk_approved) values
  ('a5c63101-0000-0000-0000-000000000000', 'Read lesson 63', '{"sections": []}', 'approved', false),
  ('a5c63102-0000-0000-0000-000000000000', 'Bulk lesson 63', '{"sections": []}', 'approved', true),
  ('a5c63103-0000-0000-0000-000000000000', 'Draft lesson 63', '{"sections": []}', 'pending', false);

-- Ada, Bola and Chi are verified Lagos students and chat members; Dayo is verified but has not
-- accepted the community rules.
do $$
declare p uuid;
begin
  foreach p in array array['a5c63001-0000-0000-0000-000000000001', 'a5c63002-0000-0000-0000-000000000002',
                           'a5c63003-0000-0000-0000-000000000003', 'a5c63004-0000-0000-0000-000000000004']::uuid[] loop
    insert into public.chat_verifications (owner_id, kind, campus_key, id_number, status) values (p, 'student', 'lagos', 'NLS/63/' || right(p::text, 1), 'pending');
  end loop;
  update public.chat_verifications set status = 'approved' where id_number like 'NLS/63/%';
  insert into public.chat_members (owner_id) values
    ('a5c63001-0000-0000-0000-000000000001'), ('a5c63002-0000-0000-0000-000000000002'), ('a5c63003-0000-0000-0000-000000000003');
end $$;

select test.as_user('a5c63001-0000-0000-0000-000000000001');
select public.chat_create_study_group('Together squad') as squad \gset
select public.chat_invite((select id from public.chat_groups where key = :'squad'), 'a5c63002-0000-0000-0000-000000000002');
reset role;
create temporary table g63 as select id, key from public.chat_groups where key in (:'squad', 'lagos');
grant select on g63 to authenticated;
select test.as_user('a5c63002-0000-0000-0000-000000000002');
select public.chat_answer_invite((select id from g63 where key like 's-%'), true);
reset role;

-- Sharing ---------------------------------------------------------------------------------------
select test.as_user('a5c63002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.chat_lesson_topics() where topic like '% topic 63') = 2, 'only topics with an approved lesson can be picked');
select test.check(public.chat_share_lesson((select id from g63 where key = 'lagos'), 'a5c63101-0000-0000-0000-000000000000', 'Read this one') is not null,
  'a member shares a lesson card in a campus group');
select test.check(public.chat_share_lesson((select id from g63 where key like 's-%'), 'a5c63102-0000-0000-0000-000000000000') is not null,
  'and in a study group, with no note (the card is the message)');
select test.refused($$select public.chat_share_lesson((select id from g63 where key like 's-%'), 'a5c63103-0000-0000-0000-000000000000')$$,
  'a lesson still waiting for review cannot be shared');
select test.refused($$select public.chat_share_lesson((select id from g63 where key like 's-%'), 'a5c63101-0000-0000-0000-000000000000', 'call 08012345678')$$,
  'the note goes through the contact-details check');
select test.refused($$select public.chat_share_lesson((select id from g63 where key like 's-%'), 'a5c63101-0000-0000-0000-000000000000', repeat('a', 501))$$,
  'a note can be up to 500 characters');
select test.refused($$insert into public.chat_messages (group_id, body, lesson_topic_id) values ((select id from g63 where key = 'lagos'), 'x', 'a5c63103-0000-0000-0000-000000000000')$$,
  'nobody sets a lesson card by writing the message directly');
select test.check((select count(*) from public.chat_lesson_cards(array['a5c63101-0000-0000-0000-000000000000', 'a5c63102-0000-0000-0000-000000000000', 'a5c63103-0000-0000-0000-000000000000']::uuid[])) = 2,
  'cards show approved lessons only');
select test.check((select bulk_approved from public.chat_lesson_cards(array['a5c63102-0000-0000-0000-000000000000']::uuid[])),
  'and say when a lesson has not been read in full');
reset role;

select test.as_user('a5c63003-0000-0000-0000-000000000003');
select test.refused($$select public.chat_share_lesson((select id from g63 where key like 's-%'), 'a5c63101-0000-0000-0000-000000000000')$$,
  'nobody shares in a study group they are not in');
reset role;
select test.as_user('a5c63004-0000-0000-0000-000000000004');
select test.refused($$select public.chat_share_lesson((select id from g63 where key = 'lagos'), 'a5c63101-0000-0000-0000-000000000000')$$,
  'or before accepting the community rules');
reset role;
select test.as_anon();
select test.refused($$select * from public.chat_lesson_cards(array['a5c63101-0000-0000-0000-000000000000']::uuid[])$$, 'signed-out visitors see no cards');
reset role;

-- A lesson replaced by a newer version is no longer shareable until the new one is approved.
update public.topic_lessons set status = 'pending' where topic_id = 'a5c63102-0000-0000-0000-000000000000';
select test.as_user('a5c63002-0000-0000-0000-000000000002');
select test.refused($$select public.chat_share_lesson((select id from g63 where key = 'lagos'), 'a5c63102-0000-0000-0000-000000000000')$$,
  'a lesson taken back for review cannot be shared');
reset role;
update public.topic_lessons set status = 'approved' where topic_id = 'a5c63102-0000-0000-0000-000000000000';

-- This week's topic -----------------------------------------------------------------------------
select test.as_user('a5c63002-0000-0000-0000-000000000002');
select test.refused($$select public.chat_set_week_topic((select id from g63 where key like 's-%'), 'a5c63101-0000-0000-0000-000000000000')$$,
  'only the group''s creator sets this week''s topic');
reset role;
select test.as_user('a5c63001-0000-0000-0000-000000000001');
select test.refused($$select public.chat_set_week_topic((select id from g63 where key = 'lagos'), 'a5c63101-0000-0000-0000-000000000000')$$,
  'campus groups have no week''s topic');
select test.refused($$select public.chat_set_week_topic((select id from g63 where key like 's-%'), 'a5c63103-0000-0000-0000-000000000000')$$,
  'the week''s topic needs an approved lesson');
select test.check(public.chat_set_week_topic((select id from g63 where key like 's-%'), 'a5c63101-0000-0000-0000-000000000000') = 'set',
  'the creator sets this week''s topic');
select test.check((select week_topic_id = 'a5c63101-0000-0000-0000-000000000000' and week_topic_by = 'a5c63001-0000-0000-0000-000000000001' and week_topic_at is not null
                     from public.chat_groups where key = :'squad'), 'everyone can see which topic, who set it and when');
select test.check((select count(*) from public.chat_messages where lesson_topic_id = 'a5c63101-0000-0000-0000-000000000000' and body like '📌%') = 1,
  'and a card is posted in the group');
select test.check(public.chat_set_week_topic((select id from g63 where key like 's-%'), null) = 'cleared', 'the creator clears it');
select test.check((select week_topic_id is null and week_topic_by is null from public.chat_groups where key = :'squad'), 'and it is gone');
reset role;

select test.as_user('a5c63003-0000-0000-0000-000000000003');
select test.check((select count(*) from public.chat_messages where lesson_topic_id is not null and body = 'Read this one') = 1, 'a campus card is seen by the campus');
select test.check((select count(*) from public.chat_messages m join g63 on g63.id = m.group_id where g63.key like 's-%') = 0, 'study group cards stay in the group');
reset role;

do $$ begin
  begin
    update public.chat_groups set week_topic_id = 'a5c63101-0000-0000-0000-000000000000' where key = 'lagos';
    raise exception 'campus group took a week topic';
  exception when check_violation then null;
  end;
end $$;
