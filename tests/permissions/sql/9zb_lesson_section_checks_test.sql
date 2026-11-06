-- Permission tests at database level: reviewers' section ticks for reading lessons in full
-- (migration 53). Made-up names only.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('a5c53001-0000-0000-0000-000000000001', 'student53@test.invalid'),
  ('a5c53003-0000-0000-0000-000000000003', 'reviewer53@test.invalid'),
  ('a5c53004-0000-0000-0000-000000000004', 'reviewerB53@test.invalid');
update public.profiles set role = 'reviewer' where id in ('a5c53003-0000-0000-0000-000000000003', 'a5c53004-0000-0000-0000-000000000004');
update public.pilot_settings set invite_only = false;
insert into public.topics (course_id, slug, name)
  select id, 'potoroo-costs-53', 'Potoroo costs' from public.courses where slug = 'civil-litigation';

select test.as_user('a5c53003-0000-0000-0000-000000000003');
insert into public.topic_lessons (topic_id, title, content)
  select id, 'Potoroo costs', '{"sections": [{"heading": "One"}, {"heading": "Two"}]}' from public.topics where slug = 'potoroo-costs-53';
insert into public.lesson_section_checks (lesson_id, lesson_version, section, verdict)
  select id, version, 0, 'checked' from public.topic_lessons where title = 'Potoroo costs';
select test.check((select checked_by = 'a5c53003-0000-0000-0000-000000000003' from public.lesson_section_checks),
  'a reviewer ticks a section, recorded as theirs');
insert into public.lesson_section_checks (lesson_id, lesson_version, section, verdict, note)
  select id, version, 1, 'problem', 'The limitation period is wrong' from public.topic_lessons where title = 'Potoroo costs';
select test.check((select count(*) from public.lesson_section_checks) = 2, 'and marks another as a problem with a note');
select test.refused($$insert into public.lesson_section_checks (lesson_id, lesson_version, section, verdict)
  select id, version, 2, 'problem' from public.topic_lessons where title = 'Potoroo costs'$$, 'a problem must say what is wrong');
select test.refused($$insert into public.lesson_section_checks (lesson_id, lesson_version, section, verdict)
  select id, version, 3, 'maybe' from public.topic_lessons where title = 'Potoroo costs'$$, 'only checked or problem');
select test.refused($$update public.lesson_section_checks set checked_by = 'a5c53004-0000-0000-0000-000000000004'$$,
  'a tick cannot be put in another reviewer''s name');
do $$
begin
  insert into public.lesson_section_checks (lesson_id, lesson_version, section, verdict)
    select id, version, 0, 'checked' from public.topic_lessons where title = 'Potoroo costs';
  raise exception 'FAILED: a second tick for the same section and version was allowed';
exception when unique_violation then
  raise notice 'ok - one tick per section of a version: ticking again changes it (refused)';
end $$;
reset role;

select test.as_user('a5c53004-0000-0000-0000-000000000004');
update public.lesson_section_checks set verdict = 'checked', note = null where section = 1;
select test.check((select checked_by = 'a5c53004-0000-0000-0000-000000000004' from public.lesson_section_checks where section = 1),
  'another reviewer can re-check a section, recorded as theirs');
reset role;

select test.as_user('a5c53001-0000-0000-0000-000000000001');
select test.check((select count(*) from public.lesson_section_checks) = 0, 'students cannot see reviewers'' ticks');
select test.refused($$insert into public.lesson_section_checks (lesson_id, lesson_version, section, verdict)
  select id, 1, 5, 'checked' from public.topic_lessons$$, 'or tick sections');
delete from public.lesson_section_checks;
reset role;
select test.check((select count(*) from public.lesson_section_checks) = 2, 'or clear them');

select test.as_anon();
select test.refused($$select count(*) from public.lesson_section_checks$$, 'visitors cannot read ticks');
reset role;

-- Deleting a lesson removes its ticks.
delete from public.topic_lessons where title = 'Potoroo costs';
select test.check((select count(*) from public.lesson_section_checks) = 0, 'ticks go with their lesson');
