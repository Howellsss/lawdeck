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
⬜ Supabase development project created (EU region, pgvector on) — moved to the start of Phase 1, where it is first used
✅ Anthropic account with $10 credit; key added to Vercel as a secret (⬜ confirm the $20 monthly limit is set)
⬜ Voyage AI account and key — moved to Phase 2, where it is first used
✅ Health check shows Claude's "OK" on the live site (claude-haiku-5-5, about 1.1 s)

## Phase 1. Shell, accounts and data

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
⚠️ 1b. Email templates — Supabase only allows editing them after a custom email service (SMTP) is connected. Needs a decision from the founder before real students sign up
⚠️ 1b. First real sign-up test on lawdeck.vercel.app — founder to try it with their own email
✅ 1c. Database tables written as migrations: profiles, plans, courses, topics, projects, conversations, messages, usage_events, audit_log — row-level security on every table
✅ 1c. Permission tests pass on a local copy (29 checks; deliberately broken rules are caught)
✅ 1c. The three migrations applied in Supabase (2026-10-21)
✅ 1c. Permission tests on the real project — run on GitHub (step 1e)
✅ 1d. Projects: create, rename, delete (with confirmation); project page lists its chats
✅ 1d. Recents in the left menu shows the student's latest chats; read-only chat page
✅ 1d. Courses page reads the five courses from the database
⬜ 1d. Founder tries projects on the live site (signed-in journeys are not yet browser-tested automatically; that needs the test accounts in step 1e)
✅ 1e. Automatic checks on every pull request (GitHub Actions): lint, types, unit tests, build, browser tests, database permission rules, library security check
✅ 1e. Real-project permission tests run on GitHub on every pull request (test accounts and secrets added by the founder)
✅ 1e. Google sign-in built ("Continue with Google"), hidden until switched on
⚠️ 1e. Google sign-in switched on — needs a Google Cloud sign-in client, the Supabase Google setting and GOOGLE_SIGN_IN_ENABLED=true in Vercel (founder; steps in docs/specs/sign-in.md)

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
- 2026-10-21: Real-project permission tests added to the automatic checks.
