# Handoff: where Lawdeck work stands

Read this first when the founder says "continue", "call" or "pick up where we left off", in any
Claude session or account. Then read `CLAUDE.md` (the rules) and the last 30 lines of
`docs/progress.md` (the dated log). Update this file at the end of every piece of work, in the
same pull request, so the next session always starts from the truth.

Last updated: 2026-11-24 (library: no duplicates, migration 71 pasted; public Drive files refused by the key now download).

## In progress right now (2026-11-15) — read this first
- **Library duplicates and Drive downloads (2026-11-24, migration 71, pasted by the founder):** pasted links skip files
  already in the library (same Drive file, contents, or name and size). When Google refuses Lawdeck's key for a file shared
  "Anyone with the link" (the Professional Ethics folder), the import uses Google's ordinary download address instead.
  Founder to re-import the Professional Ethics link. Admin → Library list failed with code 57014 (too slow): fixed by migration 72
  (`20261124007200_library_list_counts.sql`), founder pastes it before merge.
- **Deeper answers (2026-11-24):** 16 passages per answer (was 8), problem questions up to 30. About ₦20 more AI per
  answer (≈ ₦65 per credit). Answer test waived by the founder (no Anthropic credit); run it on Sonnet (≈ $4) when credit returns.
- **Drafts and precedents (all courses) (2026-11-24, migration 70):** a library section beside the five courses; searched
  with every course's questions; never shown to students as a course. Founder pastes migration 70 before merge.
- **Library slides and large files (2026-11-22, docs/specs/library.md):** PowerPoint (.pptx) and 100 MB library files,
  big scanned PDFs cut into page batches with pdf-lib (founder approved the library). Migration 69. Founder: paste
  migrations 68 and 69, raise Supabase's project upload limit to 100 MB, then import the knowledge-base folder
  (9 links; old .ppt files must be saved as .pptx; untick EXAM SLIP.pdf, which looks like a personal document).
- **Anthropic key (2026-11-20):** the old personal keys all expired 21 Nov 2026. New key `lawdeck-production-2` (scope
  Lawdeck API workspace, no expiry) is in Vercel and the GitHub secret; founder tested an answer on the live site. The
  live site had been using `lawdeck production 2` in the Default workspace (outside the Lawdeck API spending limit); the
  new key is inside it. Old keys left to expire. Credit balance was $4.07: founder to top up and turn on auto-reload.
- **Payments (launch task 15, docs/specs/payments.md):** founder chose Flutterwave, pay each month, ₦3,999 / ₦8,499 /
  ₦13,999. Part 1 (migration 68: paid plans, credits, Admin → Plans) built; the founder pastes migration 68 before it
  merges. Part 2 (Flutterwave checkout) needs the founder's Flutterwave test keys; part 3 reminders + Terms wording.
- **Voice mode hearing (2026-11-17):** Step 1 built (law-word correction, new-topic search, busy reply; docs/specs/voice.md).
  Founder tested by voice 2026-11-18: works well. Step 2 (Azure speech-to-text with a law phrase list) waits for the founder's decision: voice
  goes to Microsoft, ≈₦1,400/hour, new library.
- **Launch list (17 tasks), reviewed with the founder 2026-11-18:** done 1 (Resend email), 2 (ID test switch off),
  3 (Anthropic limit), 5 (Supabase Pro settings), 6 (staging + monthly practice restore), 7 (load test: ~500 at once on
  Micro; re-test 1,000 after Vercel Pro), 10 partly (/privacy, /terms, consent record migration 67). 4: Google sign-in
  published; domain verified in Search Console (sc-domain:mylawdeck.com) and branding **resubmitted 2026-11-18**, Google
  answers in 2–3 working days. 9 done 2026-11-18 (Sentry org "LawDeck", EU region, SENTRY_DSN in Vercel Production, redeployed; first event not yet seen). Open: 8 Vercel Pro, 10 lawyer review + wording decisions, 11–14 legal
  reviewer (library recheck, test questions/ratings, templates + marking guides, marking agreement), 15 payment provider,
  16 final prices/free limits, 17 pilot.
- **Staging:** Supabase project `lawdeck-staging` (ref drnqgbtrutlhhcsacqll), moved into the Howells **Pro** org on
  2026-11-15 and set to **Medium** compute for a re-test (≈$59/month if left on — **set it back to Micro or Nano after
  testing**). Vercel branch `staging` → https://lawdeck-git-staging-howells1.vercel.app with Preview-only vars
  (staging keys, APP_ENV=staging, LAWDECK_PRETEND_AI=1). GitHub secrets: STAGING_DB_URL, STAGING_SUPABASE_URL,
  STAGING_PUBLISHABLE_KEY, STAGING_SECRET_KEY, VERCEL_BYPASS_SECRET. Workflows: Staging set-up, Practice restore,
  Load test (docs/specs/staging.md).
- **Load test results:** Nano: 100 passed, 200 ≈60%, 500 failed. Medium: 200 passed, 500 all in (first words 3.17 s).
  **Micro (live size), 2026-11-17: 200 and 500 passed; 1,000 failed** (runs 44093755780, 44094420843, 44095164337).
  1,000 on Medium (run 44101849082): all answered but 15–30 s waits. Large 1,000 (run 44112182906): everyone served, 13–30 s waits; database no longer the limit, next Vercel Pro then
  re-test. Staging was set to Large for that run; **founder switched it back to Micro (2026-11-18)**. Recommendation given: Micro day to day, Medium for launch week, stagger announcements; Anthropic is Build tier (about 600 answers a minute on Sonnet, enough); its credit balance was $4.31 on 2026-11-17: founder to top up and turn on auto-reload.
- **Policy fixes waiting on the founder:** Voyage training opt-out (email sent to Voyage support; update Privacy
  Notice/questionnaire Q34–37, Q59 when they reply); contact email privacy@mylawdeck.com vs lawdeck01@gmail.com;
  policies say "18+ or parental consent" and "university students and lawyers" but the founder said 18+ only, Law
  School students and applicants, Nigeria only (fix unless they object).
- Data protection questionnaire answers (Word) were built outside the repo in the old session; regenerate from
  docs if needed.

## The founder
- Not a developer. Plain language, short messages, the ✅ / ⬜ / ⚠️ format with **Impact** and
  **Next** (see `CLAUDE.md`). Every manual step gets direct links (GitHub file, Supabase SQL
  Editor, the Lawdeck page to check). Never ask for secrets in chat.
- Plan first and wait for "approved" before building a feature. Small pull requests; the AI merges
  its own once every check is green (never with a failing or skipped check).
- Migrations: the founder pastes each new file in `supabase/migrations/` into the Supabase SQL
  Editor (https://supabase.com/dashboard/project/vvidwaslcbmzbrcqvdyz/sql/new) and replies "done";
  merge only after that. The latest is **72** (`20261124007200_library_list_counts.sql`, fast library list; 71 is no duplicate library files).

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
  #173 quiz extras · #174 study together · #175 polls · #176 group calls · #177 invite links · #178 call Leave fix · #179 dictation, MCQ up to 30, quiz music. #180 quiz music louder and steady. #181 smooth quiz bass. #183 louder voice mode. #184 library Drive links and Apply to all (founder to add GOOGLE_DRIVE_SERVER_KEY in Vercel). Voice mode by name (instant greetings with the student's first name, quicker listening, prompt explain-v10) merged as #185. Voice reading provisions in full ("section 46, subsection 1, paragraph A") merged as #186. Enter-key fix (new line in the question box) merged as #187. Problem-question fix (parts searched one by one, prompt explain-v11, server guard that asks once more instead of showing a whole-question "Not enough"; `src/lib/questionParts.ts`, `composeAnswer` in `src/server/learn/ask.ts`) merged as #188; the explanations eval must be re-run for explain-v11 once the Anthropic account has credit (founder's approval needed: it costs API money). Privacy Notice and Terms pages merged as #190. Consent record (sign-up tick box, one-time "Before you continue", migration 67 applied by the founder 2026-11-13) merged as #189. Data protection questionnaire answered (outside the repo); founder still to opt out of Voyage training if wanted and switch on two-step login. Next asked by the founder: rename and delete a study group from a ⋯ menu in the group header (the server functions and a Members-tab version already exist; a header menu was drafted but set aside). The explanations eval run after #185 stopped halfway: the Anthropic account ran out of credit (founder to top up, then re-run only cases Q46-Q52 on claude-haiku-5-5). Pitch deck (pre-seed, $120,000 ask) made outside the repo in /home/user/lawdeck-proposal/pitch-deck.html.

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
  (migration 60). Group quiz like Kahoot (migration 61) with music, countdown, streaks, chart and podium (62). Study together: lesson cards in any group and "This week's topic" in study groups (63). Polls in any group (64). Group calls in study groups with LiveKit (65; hidden until the founder adds LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Vercel; free plan, 4,500-minute monthly limit on Admin → Chat). LiveKit keys are in Vercel (founder,
  2026-11-06); the founder made a test call that worked (2026-11-06); Leave was fixed after. Invite links and the ID test switch (66). The
  founder is turning invite-only off (Lawdeck open to everyone) and chat is open; the ID test switch
  must be turned off before real students join. Adding an email on Admin → Pilot only gives access
  to people who sign in with Google (not needed once invite-only is off). Pilot invites run alongside (founder: build and invite now).
  Phase 4 (direct messages, private groups, reactions, threads) waits for the pilot.
- **Plans, credits and Flutterwave payments:** not being built (founder, 2026-11-06: "Not connecting
  payments" for now). The plans document (Free, Standard ₦6,999, Pro ₦9,999, Max ₦14,999) was made
  outside the repo; no payments branch exists.

## Open items
- ⬜ Pilot: invite 10–20 students (Admin → Pilot is built) — recommended next; needs the
  founder's go-ahead and AI budget.
- ⚠️ Payments (7b): founder to choose a Nigerian provider, prices and free-tier limits.
- ✅ Sign-in emails: Resend (free plan, 100 a day; upgrade before a big campaign), sender no-reply@mail.mylawdeck.com, templates in Supabase (docs/specs/sign-in.md).
- ⚠️ Legal reviewer: approve the first drafting templates, check the 52 test questions, write
  marking guides, recheck the library.
- ⚠️ Privacy Notice and Terms of Use: review by counsel.
- ✅ Supabase Pro and its settings (2026-11-14, see progress). ⬜ Vercel Pro, staging project with a practice restore, load test. ⬜ Google branding verification (domain proof in Search Console, then resubmit). ⬜ Voyage training opt-out decision; ⬜ privacy@mylawdeck.com mailbox (ImprovMX forwarding) or switch the policies to lawdeck01@gmail.com; ⬜ policies say under-18 with consent and "university students and lawyers", founder said 18+ only, Law School students and applicants in Nigeria.
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
