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
⬜ 2d. Test the two Voyage models on 30 Civil Litigation questions and record the choice (needs 2g material and the 30 questions)
✅ Extra (founder request). Import library files from Google Drive: pick several files, details suggested from file names
⬜ Extra. Google Cloud set-up for the Drive import (founder)
⬜ 2e. Reviewer console: approve, correct, reject, withdraw; reviewer and date recorded
⬜ 2f. Out-of-date warning for material older than a later change in the law
⬜ 2g. Civil Litigation material loaded and approved
✅ Voyage AI key added in Vercel (founder, 2026-10-21)
⚠️ Civil Litigation material — founder, by 2g
⚠️ Legal reviewer and 30 test questions — founder, by 2e

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
- 2026-10-21: Migration 6 applied in Supabase (lawdeck-dev); step 2c merged.
- 2026-10-21: Founder confirmed a test upload on the live Library page (step 2b).
- 2026-10-21: Step 2d: hybrid library search (Voyage AI + exact words), indexing admin job, reviewer test page and retrieval test.
- 2026-10-21: Migration 7 applied and service-role key added (founder); step 2d merged.
- 2026-10-21: Google Drive import for library files (founder request): pick several files, details suggested from file names, same checks as uploads.
