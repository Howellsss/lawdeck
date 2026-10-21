# Learn: ask and explain (Phase 3)

PRD LN-01 to LN-04, WS-04; Engineering Rules G-01 to G-10; System Design §2 and §5.

## Steps 3a and 3b: a streamed, sourced, checked answer

- **Asking.** On the home screen a student types a question (Learn or Auto mode, a course or "All courses"). Lawdeck starts a chat and opens it. The chat page asks the question and the answer appears as it is written. Follow-up questions go in the box at the bottom. Draft mode says drafting arrives in Phase 5.
- **How an answer is made** (`src/server/learn/ask.ts`):
  1. The chat must be the student's own (row-level security). The question is saved.
  2. Email addresses and phone numbers are removed from what leaves Lawdeck (`src/server/learn/redact.ts`, rule G-06). The student's own copy is unchanged.
  3. The library is searched as the student through `search_library`: approved material only, the chat's course or all courses, never out-of-date material, at most 8 passages after re-ranking. Each question counts towards the student search limit.
  4. If nothing is found, Lawdeck says so plainly and does not call Claude.
  5. Otherwise Claude (`MODELS.explain`, Sonnet 5.5 until the 3e model test) gets the versioned instructions (`src/prompts/explain.ts`), the last few messages and the passages, marked as material with numbers S1, S2 … It answers in the set structure (short answer, rule, authority, application, exam tip) and cites passages as [S1].
  6. Every sentence is checked before the student sees it (`src/server/learn/answerFilter.ts`):
     - citations to passages that were not supplied are removed;
     - a case ("A v B") or statute ("… Act / Law / Rules") found in no supplied passage, and not among the approved statutes and rules of court in the library, is replaced with "[authority removed: not found in the Lawdeck library]";
     - a quotation over 50 words is cut, unless it comes from a statute or rule of court;
     - if Claude says the passages are not enough, the answer starts "Not enough in the Lawdeck library", says what is missing and suggests a narrower question (LN-04).
  7. The checked answer is saved with its model, tokens and cost, and the passages it cites are saved as its sources.
- **Sources** (LN-03, WS-04). Under each answer, "Sources" lists S1, S2 … with the item, heading and pages; the [S1] marks in the text are buttons too. Opening one shows the passage in the right panel. The wording comes from `source_passage`, which returns it only to the answer's owner and only while the material is approved and up to date; otherwise the panel says it was withdrawn or is being re-checked.
- **Streaming route** `POST /api/chats/[id]/answer`: refuses visitors (401), other websites (403, Origin must match), unknown chats and bad questions; sends newline-delimited JSON events (`text`, `done`, `error`). Claude is called with a 60-second limit, no long thinking first (so the first words come quickly), and the fixed instructions cached.
- **Logging** (G-08): each Claude call logs model, tokens, cost and time with the student's id, never the question or answer.

| Part | Student (owner) | Other students | Visitors |
| --- | --- | --- | --- |
| `message_sources` | Read and add for own answers | Nothing | Nothing |
| `source_passage` | Own sources, while approved and up to date | Nothing | Refused |
| `search_library` with no course | Approved, up-to-date passages of every course | — | Refused |

Tests: `tests/permissions/sql/90_answers_test.sql` (15 checks), `tests/unit/answerFilter.test.ts` (16), `tests/unit/askStream.test.ts` (6), `tests/e2e/learn.spec.ts` (4, phone and desktop), and the "B cannot reach A's work" part of `tests/permissions/workspace.test.ts`.

Not yet: Simple and Exam-ready levels, course hubs, Auto routing (3c); per-student limits before each call (3d; until then only the founder and test accounts should use it); the evaluation set and model test (3e).

### Founder step for 3a/3b

Paste `supabase/migrations/20261021001200_answers_and_sources.sql` into the Supabase SQL Editor of **lawdeck-dev** and run it. Expected: "Success. No rows returned". Do this before the code goes live.
