-- Lawdeck migration 22: the fifth course's name shows that it covers Professional Ethics
-- (founder, 2026-10-23). PRD Appendix A calls it "Law in Practice (Ethics and Skills)"; students
-- look for "Ethics". Name only: the course, its slug and everything filed under it stay the same.
update public.courses
   set name = 'Law in Practice (Professional Ethics)'
 where slug = 'law-in-practice';
