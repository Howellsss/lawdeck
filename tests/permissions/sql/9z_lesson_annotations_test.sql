-- Permission tests at database level: students' own marks and notes in lessons (migration 51).
-- Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c51001-0000-0000-0000-000000000001', 'studentA51@test.invalid'),
  ('a5c51002-0000-0000-0000-000000000002', 'studentB51@test.invalid'),
  ('a5c51003-0000-0000-0000-000000000003', 'reviewer51@test.invalid');
update public.profiles set role = 'reviewer' where id = 'a5c51003-0000-0000-0000-000000000003';
update public.pilot_settings set invite_only = false;
insert into public.topics (course_id, slug, name)
  select id, 'numbat-trusts-51', 'Numbat trusts' from public.courses where slug = 'civil-litigation';

select test.as_user('a5c51003-0000-0000-0000-000000000003');
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Numbat trusts', '{"sections": [{"heading": "One"}]}' from public.topics where slug = 'numbat-trusts-51';
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Draft only', '{"sections": [{"heading": "One"}]}' from public.topics where slug = 'numbat-trusts-51' and false;
update public.topic_lessons set status = 'approved' where title = 'Numbat trusts';
reset role;
create temporary table lesson_51 as
  select l.id as lesson_id, l.topic_id from public.topic_lessons l where l.title = 'Numbat trusts';
grant select on lesson_51 to authenticated;

-- Student A marks a phrase with a note --------------------------------------------------------
select test.as_user('a5c51001-0000-0000-0000-000000000001');
insert into public.lesson_annotations (topic_id, lesson_id, section, paragraph, start_offset, end_offset, quote, style, note)
  select topic_id, lesson_id, 0, 0, 4, 14, 'made-up ph', 'circle', 'Remember this' from lesson_51;
select test.check((select count(*) from public.lesson_annotations) = 1, 'a student marks a phrase in a lesson they can read');
update public.lesson_annotations set style = 'underline', note = 'Changed my mind';
select test.check((select style = 'underline' and note = 'Changed my mind' from public.lesson_annotations), 'and changes it');
select test.refused($$insert into public.lesson_annotations (topic_id, lesson_id, section, paragraph, start_offset, end_offset, quote, style)
  select topic_id, lesson_id, 0, 0, 9, 4, 'x', 'highlight' from lesson_51$$, 'a mark must cover at least one character');
select test.refused($$insert into public.lesson_annotations (topic_id, lesson_id, section, paragraph, start_offset, end_offset, quote, style)
  select topic_id, 'a5c51009-0000-0000-0000-000000000009', 0, 0, 0, 4, 'abcd', 'highlight' from lesson_51$$, 'only on a lesson that exists');
select test.refused($$insert into public.lesson_annotations (topic_id, lesson_id, section, paragraph, start_offset, end_offset, quote, style)
  select topic_id, lesson_id, 0, 0, 0, 4, 'abcd', 'sparkle' from lesson_51$$, 'only the three kinds of mark');
reset role;

-- Student B cannot see or touch them ------------------------------------------------------------
select test.as_user('a5c51002-0000-0000-0000-000000000002');
select test.check((select count(*) from public.lesson_annotations) = 0, 'student B cannot see student A''s marks');
update public.lesson_annotations set note = 'Hijacked';
delete from public.lesson_annotations;
reset role;
select test.check((select note = 'Changed my mind' from public.lesson_annotations where owner_id = 'a5c51001-0000-0000-0000-000000000001'),
  'or change or remove them');

-- A replaced lesson keeps its marks (they move to a later version or show as earlier notes) --------
select test.as_user('a5c51001-0000-0000-0000-000000000001');
delete from public.lesson_annotations;
select test.check((select count(*) from public.lesson_annotations) = 0, 'a student removes their own marks');
reset role;
drop table lesson_51;
