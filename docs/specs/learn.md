# Learn: ask and explain (Phase 3)

PRD LN-01 to LN-04, WS-04; Engineering Rules G-01 to G-10; System Design §2 and §5.

## Steps 3a and 3b: a streamed, sourced, checked answer

- **Asking.** On the home screen a student types a question (Learn or Auto mode, a course or "All courses"). Lawdeck starts a chat and opens it. The chat page asks the question and the answer appears as it is written. Follow-up questions go in the box at the bottom. Draft mode says drafting arrives in Phase 5.
- **How an answer is made** (`src/server/learn/ask.ts`):
  1. The chat must be the student's own (row-level security). The question is saved.
  2. Email addresses and phone numbers are removed from what leaves Lawdeck (`src/server/learn/redact.ts`, rule G-06). The student's own copy is unchanged.
  3. The library is searched as the student through `search_library`: approved material only, the chat's course or all courses, never out-of-date material, at most 8 passages after re-ranking. Each question counts towards the student search limit.
  4. If nothing is found, Lawdeck says so plainly and does not call Claude. But if search by meaning could not run (Voyage busy or unreachable) and the exact-words search found nothing, it asks the student to try again in a minute instead: "nothing found" would not be reliable then.
  5. Otherwise Claude (`MODELS.explain`, Sonnet 5.5 until the 3e model test) gets the versioned instructions (`src/prompts/explain.ts`), the last few messages and the passages, marked as material with numbers S1, S2 … It answers in the set structure (short answer, rule, authority, application, exam tip) and cites passages as [S1].
  6. Every sentence is checked before the student sees it (`src/server/learn/answerFilter.ts`):
     - citations to passages that were not supplied are removed;
     - a case ("A v B") or statute ("… Act / Law / Rules") found in no supplied passage, not among the approved statutes and rules of court in the library, and not found anywhere else in the approved library (whole-library lookup, migration 16; if the lookup fails, the name is removed) is replaced with "[authority removed: not found in the Lawdeck library]";
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

Not yet: per-student limits before each call (3d; until then only the founder and test accounts should use it); the evaluation set and model test (3e).

### Founder step for 3a/3b

Paste `supabase/migrations/20261021001200_answers_and_sources.sql` into the Supabase SQL Editor of **lawdeck-dev** and run it. Expected: "Success. No rows returned". Do this before the code goes live.

## Step 3c: levels, course hubs and Auto mode

- **Levels** (LN-02). Every answer is Simple or Exam-ready; Exam-ready is the default. Each answer shows its level and a button for the other ("Explain more simply" / "Make it exam-ready"), which asks the same question again at that level, below. The follow-up box has a Simple / Exam-ready switch. The level instruction (`LEVEL_INSTRUCTIONS` in `src/prompts/explain.ts`, now `explain-v2`) goes with each question, so the fixed instructions stay cached. The level is saved with the question and the answer.
- **Course hubs** (LN-05). Courses → a course lists its topics in teaching order; "Explain" starts a Learn chat in that course ("Explain <topic>"). Practice sessions from a topic arrive in Phase 4.
- **Topics editor** (admins only, on the course page): add, rename, move up or down, remove (after a confirmation; chats already started are kept). A topic's web address part is made from its name and never changes. Topics are curriculum structure only (rule H-01). Students and reviewers can only read them (migration 13).
- **Auto mode** (WS-03). In Auto, Claude Haiku (`MODELS.routing`, `src/prompts/route.ts`, `route-v1`) reads the request (personal data removed) and replies "learn" or "draft". Learn starts the chat as usual and the chat shows "Treated as: Learn" with "Switch to Draft". Draft shows "Treated as: Draft" with "Treat as Learn instead" until drafting arrives (Phase 5). If Haiku cannot be reached within 8 seconds, or replies oddly, the request is treated as Learn. Each routing call logs model, tokens, cost and time, never the request.
- **Routing test**: `tests/eval/routing/requests.json` (100 requests: 60 Learn, 40 Draft, including "how do I draft…" questions, which are Learn). Target at least 90 correct. Run from GitHub: Actions → "Routing test" → Run workflow (needs the `ANTHROPIC_API_KEY` repository secret), or `npm run eval:routing` locally.

| Part | Students | Reviewers | Admins |
| --- | --- | --- | --- |
| `topics` | Read | Read | Add, rename, reorder, remove |
| `conversations.auto_routed` | Set on their own new chats | — | — |

Tests: `tests/permissions/sql/95_topics_test.sql` (10 checks), `tests/unit/learnLevelsRouting.test.ts` (6), browser tests for the course hub and its editor being hidden from visitors.

### Founder steps for 3c

1. Paste `supabase/migrations/20261021001300_topics_and_routing.sql` into the Supabase SQL Editor of **lawdeck-dev** and run it ("Success. No rows returned"). Before the code goes live.
2. Add each course's topics: Courses → a course → Manage topics.
3. For the routing test: add `ANTHROPIC_API_KEY` as a GitHub repository secret (Settings → Secrets and variables → Actions), then run Actions → "Routing test".


## Usage records and the monthly limit (step 3d, migration 14)

- **Every AI call is recorded** in `usage_events` through `record_ai_usage` (answers, Auto routing, reading scans): model, tokens, cost in US dollars and time. Never the question or the answer. The owner always comes from the sign-in; students cannot write, change or delete these rows directly, or see anyone else's.
- **A question counts** when its answer has been written by the AI. Failed answers, refused answers and "nothing in the library" replies are free. Routing calls are recorded for cost but do not count as questions.
- **The limit:** the Free plan allows **30 questions a month** (the founder's default, 2026-10-22). The month runs from the 1st in Lagos time. Reviewers and admins are not limited. A plan with an empty limit has no limit (for paid plans later).
- **Checked before anything happens:** before the question is saved, before search and before any AI call, in the answer route and before Auto routing when a chat starts. If the count cannot be read, Lawdeck does not call the AI and asks the student to try again.
- **On screen:** "18 of 30 questions left this month" under the question box on the home page and in chats; at the limit, "You’ve used all 30 questions for this month. You can ask again from 1 November."
- **Changing the limit** needs no code. In the Supabase SQL Editor: `update public.plans set monthly_message_limit = 50 where name = 'Free';`
- **Tests:** `tests/permissions/sql/97_usage_limits_test.sql` (15 checks), `tests/unit/allowance.test.ts`, `tests/unit/usageLimits.test.ts`.

Founder step: paste `supabase/migrations/20261021001400_usage_limits.sql` into the Supabase SQL Editor of **lawdeck-dev** and run it, before this is merged.

## The answer quality test (step 3e, migration 15)

- **Test set:** `tests/eval/explain/civil-litigation.json`: 40 questions (30 exam-ready, 10 simple) with the points a correct answer must make, and 12 pushback cases: the student states something wrong, pushes back on a correct answer without a source, cites a made-up authority, or gives a valid correction. Drafted by the AI from Sarumi's notes (start to pleadings); **a legal reviewer must check it before the results are relied on.** Notes conflicts found while drafting are listed in the 3e pull request.
- **The test** (`jobs/explain-eval.job.ts`, GitHub Actions "Answer test", a marked admin job): every case goes through the same search and the same answer code students get (`composeAnswer`), on Claude Haiku 5.5, Sonnet 5.5 and Opus 5.5, each with the lowest thinking setting it accepts. Claude Opus 5.5 then grades each answer against the case's points (`src/prompts/evalGrade.ts`). A trial run can take a few cases (e.g. `Q01,P01`) and one model.
- **Private results:** the repository is public, so the job prints only ids, counts and cost. Answers, grades, timing and cost go to `eval_runs` and `eval_answers`, which only reviewers and admins can read; only the job writes them.
- **Review page:** `/admin/eval` (reviewers and admins, "Answer tests" in the menu). One case per page, each model's answer shown as "Answer A, B, C" in an order that differs per case, so the reviewer does not know which model wrote it. The reviewer chooses Approve or Needs fix with a note; the database records who and when. A table compares the models against the Phase 3 exit checks: 85%+ approved, zero made-up authorities, every pushback case passed, first words within 3 seconds (median), and cost per answer.
- **Tests:** `tests/permissions/sql/98_answer_evaluation_test.sql` (10 checks), `tests/unit/evalSummary.test.ts`, `evalCases.test.ts`, `evalGrade.test.ts`, and a browser test that the pages are hidden from visitors.

Founder steps: apply `supabase/migrations/20261021001500_answer_evaluation.sql`; add the GitHub secret `ANTHROPIC_API_KEY` (the workspace key) for the test to run.
