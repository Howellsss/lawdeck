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
⬜ 4d. Rubrics written and approved for Civil Litigation topics — editor built (Marking guides, migration 19); writing and approving the guides needs the legal reviewer
✅ 4e. Mark my answer: typed answers (uploads in Phase 6), Opus, structured feedback in the right panel (LN-08); live once approved guides exist
✅ 4f. Case and statute briefs (LN-09): migration 18 applied by founder 2026-10-22; Sonnet; live trial still to run
⬜ 4g. Marking agreement test: 50 answers marked by Lawdeck and by the reviewer (at least 80% agreement) — legal reviewer

## Phase 5. Draft: Nigerian-format documents

✅ 5a. Migration 21: forums, templates, template_forums, documents, document_versions, with permission tests (applied by founder 2026-10-23)
✅ 5b. Template and forum-profile files checked by schema; reviewer approval page (/admin/templates)
✅ 5c. One renderer for preview and DOCX; automatic checks (DR-06)
✅ 5d. Draft flow: document, court or registry, intake, Opus fills narrative parts, placeholders (DR-02 to DR-04) (migration 23 applied by founder 2026-10-23)
✅ 5e. A4 preview panel, edits in the panel or by instruction, versions (DR-05)
✅ 5f. "Why is it arranged this way?" and related documents for a Lagos writ (DR-08, DR-09) — the four new front-loading templates wait for the legal reviewer with 5g
⚠️ 5g. First templates (writ of summons, statement of claim, motion on notice with affidavit, deed of assignment, tenancy agreement) — written; waiting for the legal reviewer to approve them on /admin/templates; Property Law handbook to be imported into the library (founder)
✅ 5h. Export tests: DOCX pages checked automatically in LibreOffice; Save as PDF prints the preview's pages (no hosted converter, founder 2026-10-23) — founder's 10-minute check in Word and Google Docs with three sample files to do

## Phase 6. Uploads, sharing and account controls

✅ 6a. Upload notice, private file store, uploads tables and My uploads page (UP-01, UP-02, UP-03, UP-05, UP-06) (migration 24 applied by founder 2026-10-23)
✅ 6b. Reading uploads (text and scans), extraction quality flag, search index tied to the student (UP-01, UP-04); 200 scanned pages a month on Free (migration 25 applied by founder 2026-10-23)
✅ 6c. Answers use the student's uploads, labelled "From your uploads" or "From the Lawdeck library" (migration 26 applied by founder 2026-10-23); answer test run 2026-10-23: 10/10 answered, $0.43, grades reviewed by founder
✅ 6d. View-only share links, who has access, revoke (EX-04) (migration 27 applied by founder 2026-10-23)
✅ 6e. Export notes, briefs and flashcards (EX-03)
✅ 6f. Delete account (AC-05), report a problem (FB-01), takedown request route (FB-03) (migration 28 applied by founder 2026-10-23)

### Phase 7. Pre-pilot hardening
⬜ 7a. Supabase Pro and Vercel Pro; separate staging and production keys (B-04, R-01): ⚠️ founder: not upgrading yet (2026-10-23)
⬜ 7b. Payments with a Nigerian provider; plans and limits enforced (AC-03, AC-04, K-01): ⚠️ founder: provider, prices, free-tier limits
✅ 7c. Login, sign-up and reset limits (C-04, K-02) (migration 29 applied by founder 2026-10-23)
⬜ 7d. Daily backups and a practice restore into staging (Q-01, Q-02): needs 7a
✅ 7e. Error monitoring and unusual-access alerts (I-04, P-03): Sentry free plan (no library) + hourly GitHub check; migration 31 applied by founder 2026-10-23; SENTRY_DSN to set (founder)
✅ 7f. Breach response plan (P-04, Appendix D): docs/breach-response-plan.md; founder is incident lead; practice drill with the founder to do; legal duties to be confirmed by counsel with 7i
✅ 7g. Security review of permissions, secrets and uploads (P-05): findings fixed (docs/security-review.md); migration 30 applied by founder 2026-10-23; follow-up (migration 33, print-page fix) applied by founder 2026-10-23; content security policy in report-only mode until the live reports are checked
⬜ 7h. Load test for 500 concurrent users (L-03): needs 7a
⬜ 7i. Privacy Notice and Terms of Use reviewed by counsel; consent at sign-up: ⚠️ counsel
✅ 7j. Library, rubrics and templates for all five courses loaded and approved (founder, 2026-10-23); topics for all five courses added
⬜ 7k. Full evaluation set (150+ questions, 30 drafting requests) passes all launch gates: ⚠️ reviewer, then AI spend approval

### Phase 8. Closed pilot
⬜ 8.1 Invite 10–20 students, then a wider cohort: invitations built (Admin → Pilot; migration 32 applied by founder 2026-10-23); ⚠️ running the pilot needs AI funding (funding request, 2026-10-23)
⬜ 8.2 Weekly review of problem reports, evaluation results and costs: Pilot page built; weekly use during the pilot
⬜ 8.3 Measure weekly active students, messages and cost per student, marking agreement, document use: Pilot page built
⬜ 8.4 Interview pilot students on value and price: price question built; interview guide written
⬜ 8.5 Prepare the Council of Legal Education demonstration: demonstration pack written

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
- 2026-10-22: Step 4f planned and approved: saved case and statute briefs on their own page, Sonnet, counting as one question. First part: migration 18 (briefs table) with permission tests.
- 2026-10-22: Step 4f part 2 built: Briefs page (name a case or statute, choose a course), brief written by Sonnet from library passages only after checking the name is in the library; fixed sections (case: facts, issues, decision, ratio, relevance; statute: purpose, key sections, relevance); sections the library does not cover say so; saved briefs list and delete. Prompt brief-v1. No live AI test yet.
- 2026-10-22: Step 4d editor built: Marking guides page for reviewers (exam-style question, marking points with marks, draft / approve / withdraw; admins delete). Migration 19 adds the question; editing an approved guide puts it back to draft. No AI, no cost.
- 2026-10-22: Step 4e built: Mark my answer (approved exam-style questions, typed answer, Opus marking against the guide with marks clamped to each point, correct rule from the library, feedback in the right panel, saved in Practice). Migration 20. Founder: Opus for marking, typed answers now.
- 2026-10-23: Phase 5 (Draft) started. Plan approved (founder: "start"). Step 5a: migration 21 (forums, templates, template_forums, documents, document_versions) with 40 two-student and reviewer permission checks. Spec: docs/specs/drafting.md. No AI, no cost.
- 2026-10-23: The fifth course is now shown as "Law in Practice (Professional Ethics)" (founder), so students and uploads find Ethics; files with "ethics" in their name are filed there automatically. Migration 22, name only.
- 2026-10-23: Step 5b built: template and court-format files in src/templates, checked by schema before approval (rule H-03); Templates page for reviewers (load from files, approve, back to draft, withdraw; admins delete). First four court and registry files use the default formatting until a reviewer confirms them. No AI, no cost, no new library.

- 2026-10-23: Step 5c built: one document engine for the on-screen page and the Word file (library docx 9.13, founder approved), placeholders for missing facts in both, and automatic checks (missing parts and facts, impossible dates, party names written two ways, unused defined terms). A sample Word file printed by LibreOffice matched the on-screen page. No AI, no cost.
- 2026-10-23: Step 5c merged after all checks passed. Step 5d planned and approved (founder: names as stand-ins, one live test of about $0.10).
- 2026-10-23: Step 5d built: drafting catalogue, typed requests matched by Haiku, court choice, short intake, Opus writes only the narrative parts with names and addresses as stand-ins, missing facts as placeholders, citation check, automatic checks, document page with Word download, Documents list. Migration 23: a draft counts as one question. Drafting test added (made-up document). Students see documents once templates are approved (5g).
- 2026-10-23: Migration 23 applied (founder); step 5d merged. Drafting test on a made-up document: 9/9 checks (stand-ins, word limits, missing address left as placeholder, no authority, no invented sum), Opus, 6.2 s, $0.014.
- 2026-10-23: Step 5e planned and approved (founder: a change by instruction counts as one question; known names masked and new names asked for in Facts; one live test of about 3 cents). Built: A4 pages in the right panel with zoom, placeholders open their question, facts and wording edited by hand, changes by instruction (Opus, narrative parts only), versions with Look and Restore. No migration, no new library.
- 2026-10-23: Step 5e merged; drafting test with one change by instruction run on GitHub. Step 5g planned and approved (founder: all five templates; the legal reviewer approves; founder imports the Property Law handbook). Five templates written from the S.A drafts and the 2025 handbooks, with a source on every part; they load as drafts. No AI cost, no migration.
- 2026-10-23: Drafting test after 5e: 13/14 checks, $0.031 (draft 4.7 s; change by instruction asked for the new defendant, 5.9 s). The one failure was the test itself reading "N2,350,000," (with the sentence's comma) as a different sum; fixed to compare amounts.
- 2026-10-23: Step 5g merged. Step 5f planned and approved (founder: with the four front-loading templates). Built: "Why is it arranged this way?" on documents and question pages, related documents drafted with the same facts carried over, numbered lists in templates, and Form 01, list of witnesses, witness statement on oath and list of documents as drafts for review. No AI cost, no migration.
- 2026-10-23: Step 5f merged. Step 5h planned and approved (founder: Save as PDF from the pages, no hosted converter). Built: Save as PDF, parts that start a new page (the affidavit), Word keeps each paragraph together, preview spacing worked out as Word does, and an automatic export test: all 15 template and court pairs have the same pages on screen, in the PDF and in LibreOffice's print of the Word file. No AI, no migration, no new library.
- 2026-10-23: Phase 6 started (founder: "approve"). Step 6a built: upload notice (Appendix C) accepted once, private "uploads" file store with one folder per student, uploads and upload_passages tables (owner only), 50-file Free limit and notice enforced by the database, My uploads page with upload, real file-type check and delete. Migration 24; 30 database permission checks. No AI, no cost, no new library.
- 2026-10-23: Migration 24 applied (founder). Real-project check added: a second student cannot list, download, delete, overwrite or add to another student's upload.
- 2026-10-23: Step 6a merged. Step 6b planned and approved (founder: 200 scanned pages per student per month on the Free plan). Built: uploads are read straight after upload by the library's reader (now shared), with scans by Haiku and indexing by Voyage, all with the student's own session; "Ready" only with passages; failures shown with "Try again", which carries on without paying twice; hard-to-read files flagged (UP-04). Migration 25; 30 database permission checks. No live AI test yet.
- 2026-10-23: Step 6b merged (migration 25 applied). Step 6c approved and built: answers search the library and the student's own Ready uploads together (per-chat "Use my uploads" switch), sources grouped "From the Lawdeck library" / "From your uploads", prompt explain-v3 marks uploads as the student's own notes (library preferred), citation check still library-only. Migration 26; 12 database permission checks. Answer test not yet re-run.
- 2026-10-23: Step 6c merged after the answer test (10/10 answered, 6 unmatched authorities removed, $0.43; founder reviewed grades). Step 6d approved (founder: viewers must sign in) and built: view-only links to a document or project (long random token), "who opened it" list for the owner, "Turn off link" stops access at once, read-only pages under /shared/<link> for documents, project lists and chats (source titles only, never passages). Migration 27; 25 database permission checks. No AI, no cost, no new library.
- 2026-10-23: Step 6d merged (migration 27 applied; live permission check passes). Step 6e approved and built: "Download Word" and "Save as PDF" on chats (as study notes), briefs and practice sets, with "only the cards I don't know yet" for flashcards. One study-sheet model draws both files; answers not yet revealed stay hidden; source titles only, never library passages. No migration, no AI, no cost, no new library.
- 2026-10-23: Step 6e merged. Step 6f approved (two parts). 6f-1 built: Account page (sidebar email links to it) with "Delete my account" (type DELETE): the student's files are removed first, then the database deletes the account and everything it owns, at once; no service-role key; reviewer and admin accounts are removed by the founder only. Migration 28 also adds the problem_reports and takedown_requests tables used by 6f-2. 30 database permission checks. No AI, no cost, no new library.
- 2026-10-23: Step 6f-1 merged (migration 28 applied; live check passes). 6f-2 built: "Report a problem" (five categories, optional note) under every answer, document, brief and practice question; reviewer pages Reports (with what was reported, resolve) and Takedowns (due in 7 days, overdue shown, mark done); public /takedown form linked from sign-in, with a hidden spam trap. No migration, no AI, no cost, no new library. Phase 6 tasks complete; exit checklist next.
- 2026-10-23: Step 6f-2 merged; Phase 6 complete (exit checklist met). Phase 7 started; founder: no paid upgrades yet. Step 7c approved and built: 5 wrong passwords for one email in 15 minutes pauses sign-in for 15 minutes; sign-up, reset and resend limited to 5 per email and 20 per internet address an hour. Only scrambled (SHA-256) emails and addresses kept, for a day. Migration 29; 15 database checks. No AI, no cost, no new library.
- 2026-10-23: Step 7g approved and built: security review (docs/security-review.md). Browser security headers on every page (no framing by other sites, no file-type guessing, secure connections only); content security policy in report-only mode with a report address. Migration 30 (approved): visitors lose read permission on search_events (nothing was exposed). Reviewer status changes now check the role on the server. New automatic checks: every table has row-level security, every owner-rights function fixes its search path, visitors can read no table, and every server action and route checks sign-in and input. No secrets found in the code or its history. No AI, no cost, no new library.
- 2026-10-23: Step 7g merged (migration 30 applied by founder). Step 7f approved (founder: lead and data protection contact; with a practice drill) and written: docs/breach-response-plan.md (contain, assess, notify the NDPC within 72 hours and students without undue delay, fix with a test, record), with a data map, key-rotation table and incident log template. No code, no cost.
- 2026-10-23: Step 7f merged (founder's handbook copy made; practice drill done with model answers). Step 7e approved (founder: Sentry free plan) and built: server and browser errors sent to Sentry with personal details blanked (no Sentry library); migration 31 records Word downloads and exports; an hourly GitHub job checks last hour's counts (failed sign-ins, sign-ups, downloads and questions by one account) and fails, emailing the founder, when one is over its limit. No AI, no cost, no new library.
- 2026-10-23: Funding request written for the founder's finance review: about $390 (₦546,000 at ₦1,400 per $) for the remaining paid work and a two-month pilot, plus the lawyer's fee. Phase 8 pilot tools approved (founder: all six) and built: invite-only mode with invite codes (students without a code have no questions or scans), the admin Pilot page (weekly measures, cost per student in dollars and naira, week-4 retention, price answers, open reports), and a one-time price question for pilot students. Migration 32; 33 database checks. Interview guide, Council demonstration pack and decision template written as documents. No AI, no cost, no new library.
- 2026-10-23: Migrations 31 and 32 applied (founder). Step 7e merged; Phase 8 pilot tools merged. Remaining: the funded items (funding request), reviewer approvals, the other four courses' material, and running the pilot.
- 2026-10-23: Test-phase resources written for the founder: 5 testers need no paid plans, about $10–15 a month of Claude credit (top up $20). Upgrade triggers: Supabase Pro when real students' work is stored or storage passes 70%; Vercel Pro when Lawdeck becomes commercial. Free weekly database backup added (founder): encrypted with a passphrase, kept 30 days on GitHub; needs two GitHub secrets from the founder. Rehearsed locally (dump, encrypt, decrypt, restore).
- 2026-10-23: Founder reports all five courses' library material, marking guides and templates are loaded, reviewed and approved (7j). Course topics exist only for Civil Litigation; the other four courses need their topic lists for course hubs and practice by topic. Explanations, drafting and marking do not need topics.
- 2026-10-23: Topics added for the other four courses from each handbook's table of contents (founder ran the SQL): Criminal Litigation 14, Property Law Practice 9, Corporate Law Practice 16, Law in Practice (Professional Ethics) 23. Rehearsed twice on a local copy first; safe to run twice.
- 2026-10-23: Founder testing on the live site. Approved and built: the home greeting now uses the first name ("Good evening, Howells"): from "Your name" on the Account page, else the name Google gives at sign-in; never sent to the AI. Fixed: the phone menu could not scroll past Reports; its links now scroll with the account row pinned at the bottom (browser test added, shown to fail on the old menu). No migration, no AI, no cost, no new library.
- 2026-10-23: Step 7g follow-up (founder: "fix up the bug and the other concern"): migration 33 removes the unused permission to call trigger functions directly (new guarantee check 5); the notes/briefs/flashcards "Save as PDF" page now reads the clock after the sign-in check, so Next.js no longer logs an error. No AI, no cost, no new library.
- 2026-10-23: Chat menu (founder: APPROVE, with Move to project): a ⋯ button on each chat in Recents and at the top of an open chat, to rename it, move it into one of the student's projects (or out), or delete it after "Delete this chat?". Server checks sign-in and input; row-level security and the database's project rule do the rest. 10 new database checks (a student cannot move a chat into someone else's project), 6 unit tests, 1 browser test. No migration, no AI, no cost, no new library.
- 2026-10-23: Migration 33 applied (founder); 7g follow-up merged.
- 2026-10-24: Admin Users dashboard (founder: "track who just joined, their plan, paid or not"). Built overnight while the founder slept; founder reviewed, applied migration 34 and approved (2026-10-24). Admin → Users shows new students today, this week and in 30 days, students per plan, paying and failed payments, active students, a 30-day sign-ups chart, the month's AI cost, and a searchable people list (name, email, joined, plan, payment, questions this month, last active, sign-in method, unconfirmed email), with a page per person (counts only, never their work). Migration 34 adds the `subscriptions` table (nobody writes it from the app; filled once a payment provider is chosen) and admin-only database functions; 29 database checks. Spec: docs/specs/admin-users.md. No AI, no cost, no new library.
- 2026-10-24: Founder testing: "charges" on its own went to the empty drafting catalogue. Approved and built: a topic or document name on its own (up to 4 words, no word like draft, prepare or write) is answered as a question with no AI routing call; routing prompt route-v2 says the same; in Auto mode, a drafting request with no matching reviewed document is answered as a question instead of opening the catalogue. Routing test now 108 requests (8 topic-only added).
- 2026-10-24: Voice (founder: approved): a microphone button in the question box and the follow-up box. The browser's own speech recognition turns speech into words in the box to check before sending (Chrome through Google, Safari through Apple; no button in browsers without it, such as Firefox). Lawdeck never receives the recording. Microphone allowed on Lawdeck's own pages only. No AI cost, no new library.
- 2026-10-24: Public-test tools (founder: approved; "invite only made easy inside the Users section"). Migration 35: an admin presses Give access (or Remove access) next to anyone on Admin → Users, recorded in the audit log; optional limits on the Pilot page: questions per short period (e.g. 5 every 3 hours), a monthly cap (e.g. 25, replacing the plan's 30) and a scanned-page cap. Every AI request counts (explanations, practice, briefs, marking, drafts). Students who hit the short limit are told the Lagos time they can ask again. 24 new database checks. No AI, no cost, no new library.
- 2026-10-24: Problem questions (founder: approved): prompt explain-v4 answers a scenario with the facts in brief, a numbered list of every issue, each issue in turn (rule, authority, application), advice to each party and an exam tip; issues the library does not cover are named as not covered, never filled from outside knowledge. Scenarios (40 words or more) get 12 library passages instead of 8. Answer test gains 5 Civil Litigation problem questions (Q41–Q45); answer test run on Sonnet.
- 2026-10-24: Answer test on Sonnet with explain-v4 (57 cases, including problem questions Q41–Q45): 57 answered, 0 failed; the citation check removed 23 authorities not found in the library; cost about $2.61. Scores saved on /admin/eval for the founder and reviewer.
- 2026-10-25: Founder testing: a full exam problem question was refused at 2,000 characters. The question limit is now 8,000 characters (about 1,200 words) in both question boxes.
- 2026-10-25: Founder testing: a long problem question in Auto mode was taken as a drafting request and refused at 1,000 characters. Long requests (40 words or more) now go straight to Learn with no routing call; question and drafting-request limits raised to 20,000 characters (founder: highest sensible limit). The 9 templates are approved (founder).
- 2026-10-25: Founder testing: a long problem question gave "The search did not work": the database word search takes at most 2,000 characters. Long questions now send the word search their start and end (2,000 characters); the search by meaning and the re-ranker still use the whole question. No migration.
- 2026-10-25: Founder testing: "Draft the document" did nothing on the tenancy agreement. The court-or-registry choice was required with nothing pre-selected, so the browser blocked the form with a warning out of sight. The first court is now pre-selected, a missing choice is explained next to the button; a document that belongs to no court (tenancy agreement) shows no court line.
- 2026-10-25: Side panel expand (founder: approved): an expand button next to the close button makes the side panel (document pages, sources, marking feedback) fill the screen on wider screens; pressing it again or Escape shrinks it back. Phones already show the panel full screen.
- 2026-10-25: Live activity (founder: approved; mic stays black and white, option A by default): while an answer is on its way, a heartbeat line moves beside "Searching the library…", then a green tick and "Found N passages" (amber when the library has nothing); the mic shows a moving heartbeat line while recording and reads "Stop dictation"; Drafting… and Changing… buttons show a small orbit. Still for people who turn off motion.
- 2026-10-25: Document view (founder: approved): the expanded side panel opens as a large sheet in the middle of the screen with the workspace dimmed behind it; click any paragraph on the pages to change its wording (saved as a new version; signature block excluded; grey boxes still open their question). Tenancy agreement and deed of assignment now ask for the date ("made on [DATE]" replaces the dotted line): both go back to draft for re-approval.
- 2026-10-25: Stop button (founder): while Lawdeck searches or writes an answer, the send button becomes Stop; pressing it ends the answer at once and the server stops the AI call, so no more credit is spent. The part already shown stays, marked "Stopped", with Ask again.
- 2026-10-25: Mic wave (founder): while dictating, the mic shows thin bars rising and falling in a wave, like Claude's dictation; the heartbeat line is now for library searches only. The bars move on their own (not voice-driven) and stay still for people who turn off motion.
- 2026-10-25: Registered emails and the invite link (founder; migration 36 — founder to paste into Supabase): on the Pilot page the admin registers testers' emails and copies the invite link (/invite). A registered person who continues with Google gets access automatically; anyone the link is passed on to sees "Sorry, your email is not registered". Only a Google sign-in counts (email sign-up does not confirm the address). Removing an email removes its access. Invite codes still work.
- 2026-10-25: Exam-standard answers (founder; explain-v5; founder approved a 5-case answer test, Q41–Q45 on Sonnet: first run 28 authorities removed because full citations respelt party names, fixed in the prompt and the citation check, second run 5/5 answered, 3 removed, about $0.98 for both runs; 6–8 US cents per problem answer): problem questions go into every issue in depth (rule and elements, authorities, exceptions, element-by-element application, conclusion); authorities are written in full as in a Law School script (sections with subsections, full Act titles and years, NWLR citations copied exactly from the passage, never completed from memory); every answer ends with an Authorities list. The S1, S2 labels are gone from Learn answers: a small book icon opens the passage. Problem questions may run longer (7,000 tokens).
- 2026-10-25: Course drafts imported (founder: "all drafts added and approved"): 33 new templates written from the Criminal Litigation, Corporate Law and Professional Ethics drafting materials in the library — Criminal (9): police bail application, summons for bail, affidavit in support of bail, motion on notice for bail, notice of appeal, legal aid application, consent to file an information, section 84 certificate, charge; Corporate (16): memorandum of association, change of name application and special resolution, AGM and EGM notices, re-registration resolution, increase of share capital, corporate search application and report, statutory demand, winding-up petition, creditors' voluntary winding up, allotment letter, director appointment and resignation, board meeting notice; Ethics (8): adjournment letter, confirmation of instructions, closing a file, bill of charges, memo, CV, legal opinion, arbitration clause. Provisions the source does not state firmly are asked as questions rather than filled in. They load as drafts: the founder approves each on Admin → Templates.
- 2026-10-25: Student source labels and admin tracing (founder; migration 37 to paste; explain-v6, answer test after the migration): students see "Course — Topic" for lecturer notes and unidentified material, and the real title (with pages) only for official documents and named publications — in answers, the source list, the source panel, briefs, practice, marking, exports and what the AI receives; never a lecturer's name, file name, Drive link or private page numbers. The source panel shows short extracts (statutes and rules in full) and links to the course in Lawdeck. Originals are never changed: admins classify items and record permission on each library item, see where an item was used, and trace every original document and passage behind an answer (/admin/answers/…, linked from Reports). Restricted items are withdrawn at once. Template notes name drafting materials by course, not by person (mapping in src/templates/sourceLabels.json; templates unchanged, no re-approval). Sonnet now explains in its own structure, never copies or cosmetically paraphrases, prefers binding text in a conflict and never names note authors.
- 2026-10-25: Phone fit (founder, with screenshots): the home page no longer slides sideways on phones (a long signed-in greeting pushed it wider than the screen; the greeting now wraps at a phone size, and the workspace can never be wider than the screen). The question box controls sit on one row like Claude's (smaller round buttons; the course list shortens itself), the phone header buttons and menu rows are smaller. Browser test added: the main pages fit a 360 px phone.
- 2026-10-25: Approve many templates at once (founder): Admin → Templates has a tick box beside every template not yet approved, "Select all not yet approved" and "Approve selected". Each ticked template goes through exactly the same checks as approving it on its own page; any that fail stay ticked and are listed with the reason. Unit tests added.
- 2026-10-25: Phone sideways sliding, second fix (founder, with screenshot): the cause was the iPhone zooming in when the course or level picker was tapped (their text was 14px; iPhones zoom into any field under 16px, and the zoomed page then slides). On phones and touch screens every field is now at least 16px, and the page edges are clipped so nothing can slide sideways. The phone browser test now also checks that nothing pokes past the screen edge and that no field is under 16px.
- 2026-10-28: Wider pages (founder: "take off the empty space"): every page now uses up to 1,152 px of the screen instead of 768–896 px, with a little more side margin on large screens; the home question box is wider too (1,024 px). Phones are unchanged. Document sheets keep their page width.
- 2026-10-28: Voice (founder; Azure chosen; migration 38 to paste; Azure key to add on Vercel — steps in docs/specs/voice.md): every Learn answer has **Read** (whole answer aloud, Pause/Resume/Stop); **voice mode** (sound-wave button on home and in chats) listens, answers, reads the short answer aloud, offers the rest ("yes" reads it, "stop" ends), then listens again. Nigerian English voices (female Ezinne by default, male Abeo; students choose on Account). Case names read as lawyers say them ("A and B", "State against A", "section 36", "part 712", N.W.L.R.); a pronunciation list (src/templates/pronunciations.json) for names the voice gets wrong, checked on the new Admin → Voice test page. Only saved answer text goes to Azure, from the server; students can only hear their own answers; each read is logged (characters, cost, time; never text); 40,000 characters a student a day; speech never uses up questions. Buttons stay hidden until the key is added. Tests: 17 unit, 7 database, 3 browser.
- 2026-10-28: Voice fix: when Lawdeck cannot check the daily reading total (for example before migration 38 is run), it now says the voice is unavailable instead of wrongly saying the limit is reached (founder saw the limit message as an admin).
- 2026-10-28: Voice set-up help: Admin → Voice test now says exactly why the voice fails (database check, wrong key, wrong or misspelt region, Azure limits); students still see only a plain message.
