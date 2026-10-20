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
⚠️ 1b. Live sign-in — needs the Supabase project (URL and publishable key) and its settings from the founder (see docs/specs/sign-in.md)
⬜ 1c. Database tables with row-level security, and permission tests
⬜ 1d. Projects and chats saved per student
⬜ 1e. Automatic checks on every pull request; Google sign-in

## Change log

- 2026-10-20: Phase 0 code set-up (app skeleton, design tokens, AI module, health check, documents).
- 2026-10-20: GitHub Secret Protection and push protection switched on.
- 2026-10-20: Live on Vercel; Claude connection confirmed. Phase 0 exit checklist met; Supabase and Voyage set-up moved to the phases that first use them.
- 2026-10-20: Phase 1 step 1a: dark-default theme with light switch, three-pane shell, home screen, loading/empty/error screens.
- 2026-10-20: Phase 1 step 1b: sign-in screens and server logic, unit and browser tests. Waiting on Supabase project to switch on.
- 2026-10-20: Supabase project lawdeck-dev created in West EU (Ireland).
