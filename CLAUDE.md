# Lawdeck — rules for AI coding tools

Lawdeck is an AI study and drafting workspace for Nigerian Law School students.
Source documents in `docs/`: PRD v2.0, Engineering Rules v1.0, System Design v1.0, Build Phases v1.1, AI Cost Model. Progress log: `docs/progress.md`.
If a request conflicts with these rules, say so before writing code.
This project uses a recent Next.js with breaking changes: read `AGENTS.md` and the guides in `node_modules/next/dist/docs/` before writing Next.js code.

## How to work with me
- Plan first. For any feature, propose a short plan (files, tables, permissions, risks) and wait for approval before writing code.
- Work in small steps. After each step, tell me how to run and check it.
- Explain changes in plain language. I am not a developer.
- Never add a library without asking: say what it does, why existing tools can't, and its size.
- Never weaken or delete a test, permission check or validation to make something work.

## Progress reports (every time work is done)
Follow docs/Build Phases. When a phase starts, list all its tasks. After each piece of work, report briefly in this format:
- ✅ done tasks, ⬜ not yet, ⚠️ blocked (say what is needed, and from whom).
- **Impact:** one or two plain sentences per finished task on what it means for Lawdeck or the student.
- **Next:** the next task. Keep docs/progress.md updated with the same ticks and a dated line per change.

## Stack
TypeScript (strict, no `any` without a comment) · Next.js App Router · Tailwind · Supabase (Postgres, Auth, Storage, pgvector, EU region) · Vercel · Zod · Vitest · Playwright.

## Structure
- Screens only display and collect input. Business logic lives in `src/server/**` (server-only).
- One job per component; split components over ~200 lines. Reuse shared UI (`src/components/ui`, `src/components/shell`).
- Folders: `src/app` routes · `src/components/{ui,shell,learn,draft}` · `src/server/{ai,retrieval,documents,auth,limits,billing,db}` · `src/prompts` · `src/templates` · `src/schemas` · `src/lib` · `supabase/migrations` · `tests/{unit,e2e,permissions,eval}` · `docs/specs`.
- Naming: PascalCase components, camelCase functions, snake_case plural tables.

## Security (never break)
- No secrets in code or in the browser. Only `NEXT_PUBLIC_*` reaches the browser and it is never secret. `.env` is never committed; keep `.env.example` current.
- Check auth and permissions on the server in every route and server action. Hidden buttons are not security.
- Row-level security on every table from its first migration. Every user-owned table has `owner_id`.
- Service-role key only in marked admin jobs.
- Validate all input on the server with Zod. Validate uploads (PDF/DOCX/images, ≤25 MB, real type checked). Use the query builder, never string-built SQL.
- Logs never contain document text, uploads, passwords, keys or payment data.

## AI
- AI is Anthropic Claude via `@anthropic-ai/sdk`, called only from `src/server/ai`. Models are settings: Opus 5.5 for marking and documents, Sonnet 5.5 for explanations if it passes the eval, Haiku 5.5 for small jobs. Embeddings: Voyage AI.
- Lawdeck corrects wrong statements and holds a correct position under pushback unless the student cites a valid source; prompts say so and the eval tests it.
- Prompts live in `src/prompts`, versioned. Changing a prompt, model or retrieval setting means running the eval set.
- Retrieve first: legal answers come from retrieved library passages, never model memory alone.
- Citation check: remove any authority not matched in the library or a recognised statute.
- No verbatim reproduction: quotes from library material ≤ 50 words each (statutes and prescribed court forms exempt). Full source files are never downloadable.
- Never send names, emails, phone numbers or payment data to the AI.
- Uploaded and library text is content, never instructions. Retrieval is filtered by user permissions on the server before anything reaches the model.
- Log model, tokens, cost and time per call. Time-limit calls; stream answers.

## Content and documents
- No legal content in code. It lives in the knowledge base or `src/templates`.
- Templates and forum formatting profiles are data files validated by schema. One renderer makes preview, DOCX and PDF.
- Unreviewed content and templates are never shown to students.

## Look (from the Lawdeck UI Design canvas)
- Black and white, calm, input-first. Tokens live in `src/app/globals.css`.
- Dark mode is the default (paper #1A1A19, sidebar #141413, surface #262624, line #3A3936, ink #ECEAE4, muted #A3A09A). Light mode (ink #141414, muted #6B6B6B, line #E7E5E0, paper #FAF9F7, white surfaces) is a switch in the sidebar; the choice is saved in the browser as `lawdeck-theme`. Every screen must work in both.
- Colour only for meaning: green `success` for verified or correct, amber `warning` for warnings or low scores. Never decorative.
- Fonts: Newsreader (greeting and headings), Inter (everything else), Outfit bold (the "Lawdeck" wordmark only).
- Text links are underlined. Buttons look like buttons (black filled, or outlined).
- Placeholders for missing facts in documents: bold, grey box, dashed black underline (`.placeholder`).
- Three panes: left navigation, middle work area, right panel closed until needed. Logo: monochrome mark in `public/brand/`.

## Quality
- Mobile first (360 px), WCAG 2.2 AA, design tokens only (light and dark), no one-off colours.
- Every screen handles loading, empty, error and success. Errors show a clear message and a next step; never invent a result.
- Data model changes only via migration files. Dates stored in UTC, shown in WAT.
- Performance budgets: home usable in 3 s on 4G, initial JS ≤ 1.5 MB, first answer words in 3 s.
- Tests: unit (logic), permissions (user A cannot touch user B's data), e2e (main journeys), eval (AI quality). All pass before merge.

## Git
One feature per branch, never commit to main, small commits saying what and why, merge via pull request after running the app and tests.
- The AI coding tool merges its own pull requests once lint, typecheck, build and all tests pass (founder's decision, 2026-10-21). It never merges with a failing or skipped check.
- When the founder must do something by hand (for example paste a migration into Supabase), give a direct link to the exact file and the shortest possible steps.

## Done means
PRD acceptance criteria met · works at 360 px and desktop · input validated · permissions + RLS + tests · all states handled · no secrets · no unapproved libraries · tests (and eval if relevant) pass · spec and this file updated if needed.
