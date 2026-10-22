# Lawdeck progress

Key: ✅ done · ⬜ not yet · ⚠️ blocked

## Stage A. Before any code ✅

✅ PRD v2.0, Engineering Rules v1.0, System Design v1.0, Build Phases v1.1, CLAUDE.md
✅ Data model, permissions plan, environment variables list
✅ Claude chosen as the AI; Voyage AI for search
✅ UI design (black and white, Newsreader, Inter, Outfit) and brand board
✅ Legal position recorded; cost model built
⬜ Logo redrawn as a vector (SVG) file (Stage C)
⬜ Finance review of the cost model (Stage C)

## Phase 0. Foundations

✅ Private repository `lawdeck` created and connected
✅ Documents and CLAUDE.md in `docs/` and at the root
✅ Next.js app with TypeScript (strict) and Tailwind; folder structure from the Engineering Rules
✅ Design tokens: colours, fonts, underlined links, placeholder style
✅ `.env.example` listing every setting; real keys ignored by git
✅ Single AI module (`src/server/ai`) and the protected `/health` connection check
✅ Secret scanning (Secret Protection) and push protection switched on in GitHub
✅ Vercel connected; app live at lawdeck.vercel.app (framework preset set to Next.js)
✅ Supabase development project created (EU region) in Phase 1
✅ Anthropic account with $10 credit; key added to Vercel as a secret (⬜ confirm the $20 monthly limit is set)
✅ Voyage AI account and key (added in Phase 2)
✅ Health check shows Claude's "OK" on the live site (claude-haiku-5-5, about 1.1 s)

## Phase 1. Shell, accounts and data ✅ (complete 2026-10-21)

✅ 1a. Dark mode by default with a light switch (choice remembered, no flash on load)
✅ 1a. Three-pane workspace: left navigation (collapsible on desktop, drawer on mobile), middle work area, right panel closed until needed
✅ 1a. Home screen: greeting, message box, mode and course pickers, shortcuts (no AI yet)
✅ 1a. Standard loading, empty, error and "page not found" screens
✅ 1b. New tools approved and added: Supabase sign-in libraries, Vitest (unit tests), Playwright (browser tests)
✅ 1b. Sign-in screens: sign in (email first, then password), create account, confirm email, forgot and reset password, sign out
✅ 1b. Unit tests (27) and browser tests (18, phone and desktop) passing
✅ 1b. Supabase project `lawdeck-dev` created (West EU, Ireland; free plan)
✅ 1b. Sign-in code merged and live; Supabase settings added to Vercel
✅ 1b. Supabase: site address and allowed return addresses set; minimum password length 10
⬜ Before launch: connect an email service (SMTP) so sign-in emails can be edited and work across devices — founder decision on a domain name
✅ 1b. First real sign-up test on lawdeck.vercel.app (founder)
✅ 1c. Database tables written as migrations: profiles, plans, courses, topics, projects, conversations, messages, usage_events, audit_log — row-level security on every table
✅ 1c. Permission tests pass on a local copy (29 checks; deliberately broken rules are caught)
✅ 1c. The three migrations applied in Supabase (2026-10-21)
✅ 1c. Permission tests on the real project — run on GitHub (step 1e)
✅ 1d. Projects: create, rename, delete (with confirmation); project page lists its chats
✅ 1d. Recents in the left menu shows the student's latest chats; read-only chat page
✅ 1d. Courses page reads the five courses from the database
✅ 1d. Founder tried projects on the live site
✅ 1e. Automatic checks on every pull request (GitHub Actions): lint, types, unit tests, build, browser tests, database permission rules, library security check
✅ 1e. Real-project permission tests run on GitHub on every pull request (test accounts and secrets added by the founder)
✅ 1e. Google sign-in built ("Continue with Google"), hidden until switched on
✅ 1e. Google sign-in switched on and working

## Phase 2. Library and search

✅ 2a. Library database written: items, passages, review status, private file store, reviewer/admin roles; 26 new permission checks pass locally
✅ 2a. Migrations 4 and 5 applied in Supabase; founder account is admin
✅ 2b. Admin upload screen: file plus details, real file type checked, straight to the private store; list and remove
✅ 2b. Founder uploaded a test file on the live site (2026-10-21)
✅ 2c. Reading files: text from PDF and Word (new libraries unpdf and mammoth, approved), scans and photos read by Claude Haiku 5.5, split into 300–800-word passages with headings and pages; 17 new permission checks and 20 logic tests pass
✅ 2c. Migration 6 applied in Supabase (founder, 2026-10-21); code merged and live
⬜ 2c. Founder reads one scanned file on the live site; check the transcription and the cost per page
✅ 2d. Search by meaning (Voyage AI) and exact words in one database function: approved material only, filtered by course, at most 8 passages; test page for reviewers; 15 new permission checks and 12 logic tests pass
✅ 2d. Migration 7 applied in Supabase; service-role key added in Vercel (founder, 2026-10-21); search merged and live
✅ 2d. 30 test questions written from Sarumi's Civil Litigation notes (founder asked the AI to write them; a legal reviewer should check them)
✅ 2d. Retrieval test run: 28/30 with both models (target 25); library keeps voyage-4
✅ 2d. Misses diagnosed (test sound; 34/35 in the top 8) and fixed with Voyage re-ranking: 35/35 in the test
✅ 2d. Re-ranker in the live search, with a student search limit (40 an hour, 200 a day); 12 new permission checks
✅ 2d. Migration 10 applied in Supabase (founder, 2026-10-21); re-ranker live; live search 35/35 in the top 8 and top 5
✅ Extra (founder request). Import library files from Google Drive: pick several files, details suggested from file names
✅ Extra. Google Cloud set-up for the Drive import (founder); Drive import works on the live site
✅ 2e. Reviewer console: approve, correct, reject, withdraw; "law current as of" date; approval rules and audit record enforced by the database; 16 new permission checks and 10 logic tests
✅ 2e. Migration 8 applied in Supabase (founder); reviewer console merged and live
✅ 2f. Out-of-date warning: law changes recorded by reviewers; items checked before a change are marked "Needs re-check" (worked out live by the database); 13 new permission checks and 4 logic tests
✅ 2f. Migration 9 applied in Supabase (founder, 2026-10-21); merged and live
✅ 2g. Civil Litigation material loaded and approved (founder approved as interim reviewer, 2026-10-21)
✅ 2f. Out-of-date material ("Needs re-check") is hidden from student search until re-checked
✅ Q-03. Archive of original library files that nobody can overwrite or delete; originals archived when read
⬜ Q-03. Founder applies migration 11; archive job run for files read earlier
⬜ 2g. A qualified legal reviewer rechecks the founder-approved material before launch
✅ Voyage AI key added in Vercel (founder, 2026-10-21)
✅ Civil Litigation material (founder, 2026-10-21)
⚠️ Legal reviewer and 30 test questions — founder, needed for 2d and the recheck

## Phase 3. Learn: ask and explain

✅ 3a. Explanation prompt (answer structure; correct, hold position, accept a valid correction), versioned in `src/prompts/explain.ts`
✅ 3a. Explain flow: search the library (one course or all), stream the answer, save the message and its sources; personal data removed first
✅ 3b. Sources: list under each answer and [S1] buttons open the passage in the right panel (only while approved and up to date)
✅ 3b. Citation check and 50-word quote limit on every sentence before it is shown
✅ 3b. "Not enough in the Lawdeck library" answer when the passages cannot support one
✅ 3a/3b. Migration 12 applied in Supabase (founder, 2026-10-21); merged and live
⬜ 3a/3b. Founder asks a few Civil Litigation questions on the live site
✅ 3c. Simple and Exam-ready levels on every answer; course hubs list topics and start explanations; admin topics editor
✅ 3c. Auto mode routing with Haiku and the "Treated as" chip; 100-request routing test ready
✅ 3c. Migration 13 applied (founder, 2026-10-21); merged and live
✅ 3c. Routing test: 100/100 on Haiku (2026-10-22). Civil Litigation topics added; other four courses when their outlines are uploaded
✅ 3d. Every AI call recorded (model, tokens, cost, time; never the text); monthly question limit checked before each answer; "X of 30 questions left this month" note
✅ 3d. Migration 14 applied (founder, 2026-10-22); merged and live
✅ 3d. Google sign-in works on the live site (founder, 2026-10-22); the failure reason stays logged
✅ 3e. Evaluation set v1 drafted from Sarumi's notes: 40 questions and 12 pushback cases (3 each: wrong statement, holds position, made-up authority, valid correction); `tests/eval/explain/civil-litigation.json`
⚠️ 3e. Legal reviewer checks the 52 test cases, then rates the answers on /admin/eval — founder and reviewer
✅ 3e. Citation check asks the whole library before removing an authority (migration 16, applied 2026-10-22)
✅ 3e. Answer test: every case through the real answer pipeline on Haiku, Sonnet and Opus, graded automatically and saved privately for the reviewer (migration 15, /admin/eval)
✅ 3e. Migration 15 applied, GitHub keys fixed (founder, 2026-10-22); full run: 156/156 answered, $6.91
✅ 3e. Model choice: Sonnet 5.5 for explanations (founder's decision, 2026-10-22). Measured: 97% of points covered, 11/12 pushback, first words in 1.0 s, about $0.031 per answer. Opus too slow (5.5 s); Haiku cheaper but weaker. Reviewer ratings still to come

## Phase 4. Practice

✅ 4a. Migration 17: practice_sets, practice_items, attempts, rubrics, with two-student permission tests (applied by founder 2026-10-22; merged)
✅ 4b. Practice questions (multiple choice and scenario) by course and topic, from library passages only (LN-06); live trial still to run
✅ 4c. Flashcards with known and not-yet tracking (LN-07); Haiku; live trial still to run
⬜ 4d. Rubrics written and approved for Civil Litigation topics — legal reviewer
⬜ 4e. Mark my answer: typed or uploaded, structured feedback in the right panel (LN-08)
⬜ 4f. Case and statute briefs (LN-09)
⬜ 4g. Marking agreement test: 50 answers marked by Lawdeck and by the reviewer (at least 80% agreement) — legal reviewer

## Change log

- 2026-10-20: Phase 0 code set-up (app skeleton, design tokens, AI module, health check, documents).
- 2026-10-20: GitHub Secret Protection and push protection switched on.
- 2026-10-20: Live on Vercel; Claude connection confirmed. Phase 0 exit checklist met; Supabase and Voyage set-up moved to the phases that first use them.
- 2026-10-20: Phase 1 step 1a: dark-default theme with light switch, three-pane shell, home screen, loading/empty/error screens.
- 2026-10-20: Phase 1 step 1b: sign-in screens and server logic, unit and browser tests. Waiting on Supabase project to switch on.
- 2026-10-20: Supabase project lawdeck-dev created in West EU (Ireland).
- 2026-10-21: Supabase sign-in settings set (addresses, password length). Clearer message when an email link is opened in a different browser.
- 2026-10-21: Phase 1 step 1c: database migrations with row-level security, local permission tests (29 passing), real-project permission tests ready.
- 2026-10-21: Working rule: the AI coding tool merges its own pull requests after all checks pass, and gives direct links for manual steps.
- 2026-10-21: The three database migrations were applied in Supabase by the founder.
- 2026-10-21: Phase 1 step 1d: projects, Recents and courses from the database. 36 logic tests and 32 browser tests passing.
- 2026-10-21: Phase 1 step 1e: automatic checks on every pull request (GitHub Actions).
- 2026-10-21: Google sign-in built; it appears once set up in Google Cloud, Supabase and Vercel.
- 2026-10-21: "Continue with Google" uses Google's official multicolour logo (founder's request; Google branding rules).
- 2026-10-21: Real-project permission tests added to the automatic checks.

### Phase 1 exit checklist (details: docs/specs/phase-1-exit.md)

✅ Workspace works at 360, 768, 1024 px and desktop with no sideways scrolling
✅ Keyboard-only use works (two fixes made: message box focus outline; phone menu returns focus)
✅ Every table has row-level security; permission tests pass (local and real project)
✅ Home page fully loaded in about 2.1 s on simulated slow 4G (budget 3 s); 155 KB of code (budget 1.5 MB)
✅ Sign out and reset password work on the live site (founder, 2026-10-21)
✅ Google sign-in works on the live site (founder, 2026-10-21)
- 2026-10-21: Phase 1 exit checks run; two keyboard fixes.
- 2026-10-21: Phase 1 complete: founder confirmed sign out, password reset, Google sign-in and projects on the live site.

- 2026-10-21: Phase 2 started. Step 2a: library database and file store with permission tests.
- 2026-10-21: Step 2b: admin Library page with upload, real file-type check, list and remove.
- 2026-10-21: Step 2c: reading library files into passages (PDF, Word, scans and photos). Libraries unpdf and mammoth approved; scans read by Claude Haiku 5.5.
- 2026-10-21: Migration 6 applied in Supabase (lawdeck-dev); step 2c merged.
- 2026-10-21: Founder confirmed a test upload on the live Library page (step 2b).
- 2026-10-21: Step 2d: hybrid library search (Voyage AI + exact words), indexing admin job, reviewer test page and retrieval test.
- 2026-10-21: Migration 7 applied and service-role key added (founder); step 2d merged.
- 2026-10-21: Google Drive import for library files (founder request): pick several files, details suggested from file names, same checks as uploads.
- 2026-10-21: Fix: indexing sends batches that fit Voyage AI's per-minute limit and waits and carries on when asked to slow down; Library list layout no longer squeezes long titles.
- 2026-10-21: Founder indexed the Civil Litigation notes (165 of 165 passages). Step 2e: reviewer console, approval rules and audit record.
- 2026-10-21: Migration 8 applied; step 2e merged. Step 2f: law changes and the "Needs re-check" warning.
- 2026-10-21: Migration 9 applied; step 2f merged. Founder approved the Civil Litigation material as interim reviewer (2g); a legal reviewer will recheck it before launch.
- 2026-10-21: 30 retrieval test questions written from Sarumi's Civil Litigation notes. The retrieval test now paces itself to Voyage's free-tier limit.
- 2026-10-21: Retrieval test: voyage-4 28/30, voyage-law-2 28/30, exact words only 3/30. Kept voyage-4. Retrieval exit target met.
- 2026-10-21: Re-ranking (Voyage rerank-2.5) added to the live search after the test found 35/35; searches return up to 30 candidates to the server, with a student search limit. Migration 10.
- 2026-10-21: Migration 10 applied; re-ranker and search limit merged. Live retrieval test: 35/35 in the top 8 and top 5.
- 2026-10-21: Out-of-date material leaves student search until re-checked (founder's question); archive of original library files (Q-03). Migration 11.
- 2026-10-21: Phase 3 started. Steps 3a and 3b: streamed, sourced answers with citation check, quote limit and "not enough" answer; migration 12 (answer sources).
- 2026-10-21: Migration 12 applied (founder); steps 3a and 3b merged.
- 2026-10-21: Step 3c: answer levels, course hubs with admin topics editor, Auto routing with Haiku and the "Treated as" chip; migration 13.
- 2026-10-21: Migration 13 applied (founder); step 3c merged.
- 2026-10-22: Fix: when search by meaning is unavailable and nothing is found, answers ask the student to try again instead of saying the library has nothing (found on the live site).
- 2026-10-22: Founder added a Voyage payment method; Anthropic key added in Vercel. 18 Civil Litigation topics added from the 2023/24 course outline (founder pasted the SQL). Other four courses: when their outlines are uploaded.
- 2026-10-22: Live answers fail: Claude returns 400 on every call and Voyage returns 401 (key). Failed AI calls now log Claude's error type, short reason and request id (never the question or key) so the cause can be read in Vercel.
- 2026-10-22: Step 3d: AI usage recorded per call; Free plan of 30 questions a month (founder can change it in the database), checked before each answer and before Auto routing. Migration 14. Claude key changed to a workspace key (founder); answers work on the live site.
- 2026-10-22: Step 3e: test set of 52 cases, answer test on three models with automatic grading, private results and a reviewer page. Repository found to be public: test answers are kept in the database, never in GitHub logs.
- 2026-10-22: Answer test trial: migration 15 needed a schema reload; GitHub's Voyage key replaced (founder). Claude keys starting sk-ant-usr now work when ANTHROPIC_WORKSPACE_ID is set (the answer and routing tests send the Lawdeck API workspace).
- 2026-10-22: Full answer test: 156/156 answered, $6.91. Sonnet strongest (97% points, 11/12 pushback, 1.0 s, $0.031/answer); Opus too slow (5.5 s); Haiku cheapest ($0.0013) but weaker. 107 authorities removed, nearly all real court-rule names the notes contain but the answer's passages did not.
- 2026-10-22: Fix: the citation check now asks the whole approved library before removing a case or statute (migration 16); test answers keep their wording before the check, so later check changes can be tried free; answer-test page marks cases with removals. No AI calls (founder: no spending for now).
- 2026-10-22: Re-check after the citation fix: 10 Sonnet answers, 4 authorities removed (first run: about 6 per 10), $0.41. Routing test 100/100. Founder chose Sonnet 5.5 for explanations (already the setting in `src/server/ai/models.ts`).
- 2026-10-22: Phase 4 (Practice) started. Plan approved: practice set counts as 1 question; default 5 questions, maximum 10. Step 4a: migration 17 (practice_sets, practice_items, attempts, rubrics) with two-student permission tests. Spec: docs/specs/practice.md.
- 2026-10-22: Step 4b built: Practise button on each course topic, /practice list, new-set form (multiple choice or scenario, 3–10 questions), set page with server-checked answers, explanations and sources. Questions come only from library passages; items that cite nothing or name an authority not in the library are dropped. No live AI test yet (founder: no spending; one trial about 5 cents when approved).
- 2026-10-22: Step 4c built: flashcards (Haiku, founder approved; default 10 cards, at most 20), one card at a time with Show answer, Know it / Not yet saved per card, and Review "not yet" cards. Prompt practice-v2. No migration needed. No live AI test yet.
