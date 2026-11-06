-- Lawdeck migration 52: revision timing that adapts to each student and each point (Remembrance
-- Phase 4, founder approved 2026-11-06). Every revision point gets an "ease": it rises when the
-- student remembers the point and falls when they miss it, so easy points come back less often and
-- points they keep missing come back sooner (rules in src/lib/revision.ts). Existing points start
-- at the normal ease, so nothing already scheduled moves.
-- Each student's own: the existing owner-only rules on review_items cover the new column.

alter table public.review_items
  add column ease numeric(3, 2) not null default 2.50 check (ease between 1.30 and 3.00);

grant insert (ease), update (ease) on public.review_items to authenticated;

-- "Before you move on" asks the weakest due points first and counts today's revision answers.
create index if not exists recall_attempts_context_idx on public.recall_attempts (owner_id, context, created_at desc);
