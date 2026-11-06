# Handoff: where Lawdeck work stands

Read this first when the founder says "continue", "call" or "pick up where we left off", in any
Claude session or account. Then read `CLAUDE.md` (the rules) and the last 30 lines of
`docs/progress.md` (the dated log). Update this file at the end of every piece of work, in the
same pull request, so the next session always starts from the truth.

Last updated: 2026-11-06.

## The founder
- Not a developer. Plain language, short messages, the ✅ / ⬜ / ⚠️ format with **Impact** and
  **Next** (see `CLAUDE.md`). Every manual step gets direct links (GitHub file, Supabase SQL
  Editor, the Lawdeck page to check). Never ask for secrets in chat.
- Plan first and wait for "approved" before building a feature. Small pull requests; the AI merges
  its own once every check is green (never with a failing or skipped check).
- Migrations: the founder pastes each new file in `supabase/migrations/` into the Supabase SQL
  Editor (https://supabase.com/dashboard/project/vvidwaslcbmzbrcqvdyz/sql/new) and replies "done";
  merge only after that. The latest is **53** (`20261106005300_lesson_section_checks.sql`, applied).

## Where things stand (2026-11-06)
- **Remembrance brief: complete.** Lessons for all 79 topics in the five courses, all read in full
  and approved; 278 memory aids and 206 stories approved (checked in the database). Recall while
  reading, Study Diary, Before you move on, students' own marks, Revise visually, adaptive revision
  (ease per point, weakest first, 20 a day), My progress. Spec: `docs/specs/remembrance.md`.
- **Reviewing lessons:** Admin → Lessons → Read in full (one click per lesson). Course-wide lesson
  approval was retired by the founder; memory aid sets can still be approved per course.
- **Stories:** a folded "Stories in this topic (n)" line at the top of each lesson (open on Revise
  visually) and a story card under its section.
- **Last merged pull requests:** #153 wider pages · #154 adaptive revision · #155 My progress ·
  #156 skim, tick and approve · #157 one click per lesson · #158 course approval retired ·
  #159 stories easy to find · #160 stories box folded.

## Open items (nothing is half-built)
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
