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
