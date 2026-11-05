-- Lawdeck migration 48: keeping lessons up to date (founder, 2026-11-05; docs/specs/remembrance.md).
-- 1. Updating an approved lesson writes a new version beside it: students keep reading the
--    approved one until a reviewer approves the new one, which then replaces it.
-- 2. Lessons are marked when newly approved library material is about their topic, so a reviewer
--    can update just those.

alter table public.topic_lessons add column replaced_by uuid references public.topic_lessons (id) on delete set null;
alter table public.topic_lessons add column new_material_at timestamptz;

-- At most one approved version per topic (what students read) and at most one version being worked
-- on (awaiting review, rejected or withdrawn). Replaced versions are kept for the Study Diary.
alter table public.topic_lessons drop constraint topic_lessons_topic_id_key;
create unique index topic_lessons_one_approved on public.topic_lessons (topic_id) where status = 'approved';
create unique index topic_lessons_one_working on public.topic_lessons (topic_id) where status <> 'approved' and replaced_by is null;

-- Reviewers mark (and Lawdeck clears) "new library material"; only the database sets replaced_by.
grant update (new_material_at) on public.topic_lessons to authenticated;

-- When a new version is approved, the old approved one is withdrawn and marked as replaced, and
-- students' revision of the old version's questions ends (it restarts with the new questions, as
-- a rewrite always has). Runs with the database's rights so it can end every student's revision;
-- only a reviewer can approve a lesson in the first place.
create function public.topic_lessons_supersede()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    delete from public.review_items r
     using public.lesson_checkpoints c, public.topic_lessons l
     where r.checkpoint_id = c.id and c.lesson_id = l.id
       and l.topic_id = new.topic_id and l.status = 'approved' and l.id <> new.id;
    update public.topic_lessons
       set status = 'withdrawn', replaced_by = new.id
     where topic_id = new.topic_id and status = 'approved' and id <> new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.topic_lessons_supersede() from public, anon, authenticated;
create trigger topic_lessons_supersede
  before update of status on public.topic_lessons
  for each row execute function public.topic_lessons_supersede();
