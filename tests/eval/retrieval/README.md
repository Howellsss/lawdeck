# Retrieval test (Phase 2, step 2d)

Checks that the right library passage comes up for real student questions, and compares the
Voyage models in `src/server/retrieval/settings.ts`. Exit target (Build Phases, Phase 2): for 30
Civil Litigation questions, the right passage is in the top 5 results at least 25 times.

## The questions file

`civil-litigation.json`, in the same shape as `questions.example.json`. For each question the
reviewer copies a short exact phrase from the passage that answers it (`expectContains`).
A result counts as a hit when one of the top 5 passages contains that phrase (spacing and
capitals ignored), so the test still works if passages are split differently later.

## What it does

For each model it turns every Civil Litigation passage (approved and awaiting review) and every
question into search vectors, ranks passages by meaning, ranks them by exact words through
`search_library`, and combines the two the same way the database does (reciprocal rank fusion,
k = 60). It prints hits out of 30 for each model, and fails if the best model is below 25.
The words ranking from `search_library` is its top 8, so places 9–40 are not counted; they
add at most 1/69 each to a passage's score and do not change the top 5 in practice.

## Running it

It is a marked admin job: it uses the service-role key and the Voyage key, and costs a few
cents. Run it from GitHub: Actions → "Retrieval test" → Run workflow. Or locally, with
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
and `VOYAGE_API_KEY` set: `npm run eval:retrieval`.

Record each run's result in `docs/specs/retrieval-eval.md`.
