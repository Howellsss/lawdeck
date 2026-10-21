# Retrieval test results (Phase 2, step 2d)

Exit target: for 30 Civil Litigation questions, the right passage is in the top 5 results at least 25 times.
How the test works: `tests/eval/retrieval/README.md`.

| Date | Questions | Passages | General (voyage-4) | Legal (voyage-law-2) | Exact words only | Choice |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-21 | 30 from D. R. Sarumi's Notes on Civil Litigation (`tests/eval/retrieval/civil-litigation.json`), written by the AI coding tool at the founder's request; a legal reviewer should check them | 165 | 28/30 (missed 12, 13) | 28/30 (missed 12, 19) | 3/30 | Keep voyage-4: same score, already indexed, no re-indexing needed. Target (25) met. [Run](https://github.com/Howellsss/lawdeck/actions/runs/39606088051) |

About the 2026-10-21 questions: written by the AI from the notes, phrased the way a student would ask and not copied from the text. Each answer phrase appears once in the notes. They cover the first part of the notes (ADR to pleadings), because the copy read from Google Drive stopped at pleadings.

Notes on the 2026-10-21 run: both models missed question 12 (NNPC time limit), which the reviewer should look at (the phrase or the passage split may be the cause). Exact words alone found 3/30 because the questions are worded differently from the notes; ranking by meaning does almost all the work.

Diagnosis runs, 2026-10-21 ([miss report](https://github.com/Howellsss/lawdeck/actions/runs/39614176480), [weight comparison](https://github.com/Howellsss/lawdeck/actions/runs/39615711772)):
- Every answer phrase is in exactly one library passage, so the test itself is sound and no passage is badly split.
- voyage-4, 30 questions: 30/30 in the top 8 (what the AI receives). Q12 was 1st by meaning but pushed to 7th by the exact-words ranking; Q13 was 6th.
- 5 exact-term questions added (rule numbers, forms; `"kind": "exact"`). With 35 questions, voyage-4 scores 32/35 in the top 5 and 34/35 in the top 8. Q32 is at 11th.
- Exact-words weight 1, 0.5 and 0.25 give the same totals; 0 is worse, especially for exact-term questions (top 8: 3/5). The live setting (1) stays.
- Weak spot: the exact-words search requires every word of the question (`websearch_to_tsquery`), so whole-sentence questions rarely match (6/35 alone).

Re-ranking experiment, 2026-10-21 ([run](https://github.com/Howellsss/lawdeck/actions/runs/39631528055)), voyage-4, 35 questions, re-ranker reads the top 30:

| Setup | Top 5 | Top 8 | Exact-term (top 8) |
| --- | --- | --- | --- |
| Live (all words) | 32/35 | 34/35 | 4/5 |
| Most words | 25/35 | 29/35 | 2/5 |
| All words + rerank-2.5 | 35/35 | 35/35 | 5/5 |
| Most words + rerank-2.5 | 35/35 | 35/35 | 5/5 |
| Most words + rerank-2.5-lite | 35/35 | 35/35 | 5/5 |

Recommendation: keep the exact-words search as it is ("most words" alone is worse) and add rerank-2.5 over the top 30 to the live search. Cost about $0.001 per question (first 200M tokens free). Caveat: 35 questions from one document, written by the AI; a legal reviewer's questions and other courses are needed before calling this proven.

Live search check, 2026-10-21, after migration 10 ([run](https://github.com/Howellsss/lawdeck/actions/runs/39659858919)): voyage-4, top 30, then rerank-2.5. **35/35 in the top 8 and 35/35 in the top 5; exact-term questions 5/5.** Without the re-ranker (the fallback if Voyage is down) the same questions score 33/35 in the top 8 (words ranking now read 30 deep, as the database does), so the fallback is weaker and the test page warns when it is used.
