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
⬜ Vercel connected; app live on a Vercel address
⬜ Supabase development project created (EU region, pgvector on)
⬜ Anthropic account with credit and a $20 monthly limit; key added to Vercel
⬜ Voyage AI account and key
⬜ Health check shows Claude's "OK" on the live site

## Change log

- 2026-10-20: Phase 0 code set-up (app skeleton, design tokens, AI module, health check, documents).
- 2026-10-20: GitHub Secret Protection and push protection switched on.
