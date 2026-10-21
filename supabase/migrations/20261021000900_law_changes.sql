-- Lawdeck migration 9: changes in the law, and the out-of-date warning (rule KB-02).
-- Reviewers record changes (new rules, amended statutes, practice directions) with the date they
-- take effect. Any item checked only up to an earlier date, in the same course, needs re-checking.
-- Nothing is withdrawn automatically: a reviewer decides.

create table public.law_changes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  effective_on date not null check (effective_on between '1960-01-01' and '2100-12-31'),
  note text check (char_length(note) <= 2000),
  source text check (char_length(source) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.law_changes enable row level security;
create index law_changes_course_effective_idx on public.law_changes (course_id, effective_on desc);

-- Reviewers and admins only. Students and visitors get nothing.
revoke all on public.law_changes from anon, authenticated;
grant select, insert, delete on public.law_changes to authenticated;
grant update (title, effective_on, note, source) on public.law_changes to authenticated;
create policy "Reviewers read law changes" on public.law_changes
  for select to authenticated using (public.is_reviewer());
create policy "Reviewers record law changes" on public.law_changes
  for insert to authenticated with check (public.is_reviewer());
create policy "Reviewers correct law changes" on public.law_changes
  for update to authenticated using (public.is_reviewer()) with check (public.is_reviewer());
create policy "Reviewers remove law changes" on public.law_changes
  for delete to authenticated using (public.is_reviewer());

-- ---------------------------------------------------------------------------
-- Items that need re-checking: each pairing of an item with a later change in its course.
-- security_invoker: the view uses the reader's own rights, so students see nothing.
create view public.kb_items_needing_recheck
with (security_invoker = true) as
  select i.id as item_id,
         c.id as change_id,
         c.title as change_title,
         c.effective_on
  from public.kb_items i
  join public.law_changes c on c.course_id = i.course_id
  where i.law_current_as_of is not null
    and c.effective_on > i.law_current_as_of;

revoke all on public.kb_items_needing_recheck from anon, authenticated;
grant select on public.kb_items_needing_recheck to authenticated;

-- ---------------------------------------------------------------------------
-- Every recorded, corrected or removed change goes into the audit record.
create function public.audit_law_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (
    (select auth.uid()),
    case tg_op when 'INSERT' then 'library.law_change_added'
               when 'UPDATE' then 'library.law_change_corrected'
               else 'library.law_change_removed' end,
    'law_change',
    coalesce(new.id, old.id),
    jsonb_build_object('course_id', coalesce(new.course_id, old.course_id),
                       'effective_on', coalesce(new.effective_on, old.effective_on))
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function public.audit_law_change() from public, anon, authenticated;

create trigger law_changes_audit
  after insert or update or delete on public.law_changes
  for each row execute function public.audit_law_change();
