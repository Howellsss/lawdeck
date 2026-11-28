-- Lawdeck migration 76: the free trial counts from launch day for accounts made before it (founder,
-- 2026-11-28: "Lawdeck launches on Monday 30th of November").
-- A trial starts when the account is made, or on launch day for accounts made before it
-- (migration 74: the later of the two). Launch day is 30 November 2026, midnight in Lagos.
-- Accounts made from launch day on are unchanged: their 7 days start the day they join.
-- Needs migrations 1–75.

update public.plans set trial_from = '2026-11-30 00:00:00+01' where name = 'Free';
