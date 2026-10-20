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

## Change log

- 2026-10-20: Phase 0 code set-up (app skeleton, design tokens, AI module, health check, documents).
- 2026-10-20: GitHub Secret Protection and push protection switched on.
- 2026-10-20: Live on Vercel; Claude connection confirmed. Phase 0 exit checklist met; Supabase and Voyage set-up moved to the phases that first use them.
