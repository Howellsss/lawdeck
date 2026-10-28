-- Lawdeck migration 39: the answer test can record voice-mode Conversation answers
-- (founder, 2026-10-28: voice mode replies in short spoken turns, level 'talk').
-- One check on eval_answers widens; no data changes. Chat messages keep their level in their
-- content and need no change.
alter table public.eval_answers drop constraint eval_answers_level_check;
alter table public.eval_answers
  add constraint eval_answers_level_check check (level in ('simple', 'exam', 'talk'));
