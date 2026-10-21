-- Lawdeck migration 13: course topics managed by admins, and Auto routing (Phase 3, step 3c).
-- PRD LN-05 (course hubs list topics) and WS-03 (Auto mode with a "Treated as" chip).
-- Topics are curriculum structure only, never legal content (rule H-01).

-- ---------------------------------------------------------------------------
-- Topics: everyone signed in reads them (migration 1); admins now add, rename, reorder and
-- remove them from the course page. Nobody else can change them.
grant insert (course_id, slug, name, position), update (name, position), delete
  on public.topics to authenticated;
create policy "Admins add topics" on public.topics
  for insert to authenticated with check (public.is_admin());
create policy "Admins change topics" on public.topics
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins remove topics" on public.topics
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Chats started in Auto mode remember it, so the chat can show "Treated as: Learn".
alter table public.conversations add column auto_routed boolean not null default false;
grant insert (auto_routed) on public.conversations to authenticated;
