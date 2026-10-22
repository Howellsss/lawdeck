# Practice (Phase 4)

PRD LN-06 to LN-09; System Design §3 (practice_sets, practice_items, rubrics, attempts) and §4.2.

## What the student gets
- On a course page, each topic has **Practise** next to Explain. The student picks the type (multiple choice or scenario) and how many questions (3 to 10, default 5).
- Lawdeck makes the set from approved library passages on that topic. Every question, answer and explanation cites the passages it came from; questions that cite nothing are dropped, and the citation check removes any authority not found in the library. If the library has too little on the topic, the student is told so and nothing is invented.
- Multiple choice: pick an option, then see whether it was right, why, and the sources. Scenario: reveal a model answer with sources (marking of the student's own answer comes in step 4e).
- **Practice** in the sidebar lists the student's past sets.
- A practice set counts as **one** question in the monthly allowance (founder, 2026-10-22).

## Data (migration 17)
| Table | Holds | Access |
|---|---|---|
| practice_sets | course, topic, kind (mcq, scenario, flashcards), title | owner only |
| practice_items | question, choices and right choice (mcq), answer or explanation, sources (titles and labels, never passage text), flashcard known mark | owner only; the only change allowed is the known mark |
| attempts | the option picked or the written answer, score, feedback | owner only; never edited |
| rubrics | marking guides with points and marks, review status | reviewers read, write and approve; admins remove; students none |

A set can only name a topic from its own course; an item or attempt can only belong to the student's own set or item (database rules, tested in `tests/permissions/sql/9a_practice_test.sql`).

## Steps
- 4a: tables, rules and permission tests (this file, migration 17).
- 4b: making questions (Sonnet, structured output checked before use, rule F-03), screens.
- 4c flashcards, 4d rubrics with the reviewer, 4e mark my answer, 4f briefs, 4g marking agreement test.
