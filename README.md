# Lawdeck

AI study and drafting workspace for Nigerian Law School students. Private repository.

## Documents

Everything the build follows is in `docs/`:

- **PRD v2.0**: what Lawdeck does and why.
- **Engineering Rules v1.0**: how the code is written (short version in `CLAUDE.md`).
- **System Design v1.0**: the parts, the data model and permissions.
- **Build Phases v1.1**: the order of work and the exit checklist for each phase.
- **progress.md**: what is done, phase by phase.

## Run it on your computer

1. Install [Node.js](https://nodejs.org) 22 or later.
2. Copy `.env.example` to `.env.local` and fill in the values (never commit `.env.local`).
3. Install and start:

```bash
npm install
npm run dev
```

4. Open http://localhost:3000. The connection check is at http://localhost:3000/health.

## Checks before merging

```bash
npm run lint
npm run typecheck
npm test            # unit tests (logic)
npm run build
npm run test:e2e    # browser tests of the main journeys (needs the build)
npm run test:db     # database permission rules on a local PostgreSQL
npm run test:permissions  # the same rules on the real Supabase project (needs test accounts)
```

The first time, browser tests need Chromium: `npx playwright install chromium`.

## Stack

TypeScript, Next.js, Tailwind CSS, Supabase (EU region), Vercel, Claude (Anthropic) and Voyage AI.
