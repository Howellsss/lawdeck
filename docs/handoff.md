# Handoff: where Lawdeck work stands

Read this first when the founder says "continue", "call" or "pick up where we left off", in any
Claude session or account. Then read `CLAUDE.md` (the rules) and the last 30 lines of
`docs/progress.md` (the dated log). Update this file at the end of every piece of work, in the
same pull request, so the next session always starts from the truth.

Last updated: 2026-11-06 (campus chat polls).

## The founder
- Not a developer. Plain language, short messages, the ✅ / ⬜ / ⚠️ format with **Impact** and
  **Next** (see `CLAUDE.md`). Every manual step gets direct links (GitHub file, Supabase SQL
  Editor, the Lawdeck page to check). Never ask for secrets in chat.
- Plan first and wait for "approved" before building a feature. Small pull requests; the AI merges
  its own once every check is green (never with a failing or skipped check).
- Migrations: the founder pastes each new file in `supabase/migrations/` into the Supabase SQL
  Editor (https://supabase.com/dashboard/project/vvidwaslcbmzbrcqvdyz/sql/new) and replies "done";
  merge only after that. The latest is **64** (`20261106006400_chat_polls.sql`, polls; 63 is study together).

## Where things stand (2026-11-06)
- **Remembrance brief: complete.** Lessons for all 79 topics in the five courses, all read in full
  and approved; 278 memory aids and 206 stories approved (checked in the database). Recall while
  reading, Study Diary, Before you move on, students' own marks, Revise visually, adaptive revision
  (ease per point, weakest first, 20 a day), My progress. Spec: `docs/specs/remembrance.md`.
- **Reviewing lessons:** Admin → Lessons → Read in full (one click per lesson). Course-wide lesson
  approval was retired by the founder; memory aid sets can still be approved per course.
- **Stories:** a folded "Stories in this topic (n)" line at the top of each lesson (open on Revise
  visually) and a story card under its section.
- **Last merged pull requests:** … #160 stories box folded · then campus chat up to #172 group quiz ·
  #173 quiz extras · #174 study together. Polls (migration 64) is the open pull request after #174.

## In progress
- **Campus chat** (PRD v2.1 https://claude.ai/artifact/2FvRggzURzxJ3kQcpiWzM2; `docs/specs/chat.md`):
  Phase 1 campus choice (migration 54, live; seven campuses + aspirant). Phase 2 campus groups
  built (migration 55; staff only). Verification and per-campus groups (migration 56): students verify
  with their Law School ID (admin approves on /admin/chat), see their campus + All campuses only;
  aspirants see Aspirants only; contact details blocked. Phase 3 (migration 57): files in messages,
  Report a message, admin Hide, and the "Open chat to students" switch on Admin → Chat checks.
  Chat is still closed to students: the founder switches it on (after counsel's terms review).
  Everyone signed in sees Campus chat in the side menu and can send their ID while it is closed;
  the campus is asked there, not on the home page. Students also need pilot access to use chat.
  Slack-style message box (Add link box, Aa, emojis, @), member counts, Files & links tab
  (migration 58). Full emoji pack. Study groups (migration 59). Voice notes in study groups
  (migration 60). Group quiz like Kahoot (migration 61) with music, countdown, streaks, chart and podium (62). Study together: lesson cards in any group and "This week's topic" in study groups (63). Polls in any group (64). Founder's next set: LiveKit group calls (needs account,
  library and cost approval). Pilot invites run alongside (founder: build and invite now).
  Phase 4 (direct messages, private groups, reactions, threads) waits for the pilot.
- **Plans, credits and Flutterwave payments:** not being built (founder, 2026-11-06: "Not connecting
  payments" for now). The plans document (Free, Standard ₦6,999, Pro ₦9,999, Max ₦14,999) was made
  outside the repo; no payments branch exists.

## Open items
- ⬜ Pilot: invite 10–20 students (Admin → Pilot is built) — recommended next; needs the
  founder's go-ahead and AI budget.
- ⚠️ Payments (7b): founder to choose a Nigerian provider, prices and free-tier limits.
- ⬜ Sign-in emails before launch: founder to choose a domain name and email service.
- ⚠️ Legal reviewer: approve the first drafting templates, check the 52 test questions, write
  marking guides, recheck the library.
- ⚠️ Privacy Notice and Terms of Use: review by counsel.
- ⬜ Supabase and Vercel paid plans, backups to staging, load test (founder: not yet).
- Idea, not approved: lessons written in the background (less needed now all are written).

## Positioning (founder's research question, 2026-11-06)
Others help lawyers *find* the law (LawPavilion, Judy, Legalpedia) or help students *practise*
past questions (TestDriller, BarPrep, Call Ready); about five draft for lawyers (LawPavilion AI,
Case Radar, Sahel AI, Modulaw, LegalTech Innovators). Lawdeck's standout: it makes students
*remember* — reviewed lessons, recall, revision of what each student is forgetting, memory aids and
stories, Study Diary and My progress, all from the same records. Drafting differs by being for Law
School students (court formatting, placeholders, reviewer-approved templates).

## Running the checks (cloud sandbox)
- `npx tsc --noEmit`, `npm run -s lint`, `npx vitest run`.
- Build and browser tests without live keys:
  `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY npm run -s build`, then
  the same `env -u …` before `npx playwright test`; test pages: `npx playwright test --config
  playwright.voice.config.ts` (reuses the last build). Set `PLAYWRIGHT_CHROMIUM_PATH` to the
  sandbox's Chromium if needed; run `pkill -f next-server` between runs.
- Database rule tests need a local Postgres 16 (`npm run -s test:db` with `PGHOST`/`PGPORT`/`PGUSER`).
- After adding a route: `npx next typegen`. No Prettier config: keep lines about 150 wide.
- The sandbox cannot reach mylawdeck.com; check live pages through the founder.
