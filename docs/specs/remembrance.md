# Remembrance and retention system (founder's brief, 2026-11-05)

Goal: help students understand, remember and retrieve legal knowledge: **Understand, Remember,
Recall, Reinforce, Track.** All five Bar Part II courses at once (founder, 2026-11-05).

## Decisions agreed with the founder
- **What students read is a Topic Lesson**, written by Lawdeck from the reviewed library and
  approved by a reviewer before students see it. Library files themselves are never shown (rule:
  full source files are never downloadable; quotes ≤ 50 words).
- **Shared, reviewed content** (one per topic, so it is checked once and cheap): the lesson, its
  recall checkpoints, its authority cards, and (Phase 2) its memory aids and case stories.
- **Made on request per student** (follow the same rules as answers: library only, citation check,
  labelled): another memory aid, "tell it another way", everyday illustrations, marking open answers.
  These use credits.
- **Never invented:** cases, citations, decisions, sections, principles, procedure or case facts. An
  authority card shows facts only if the library gives them; otherwise "Facts not in the library:
  verification required." Everyday stories are labelled "Illustration, not a real case."
- **Smart Highlighting colours** (founder approved): blue cases (circled), green principles
  (underlined), yellow statutes (highlighted), purple exam tips (★), red exceptions (⚠), grey
  definitions (boxed). Soft, desaturated tones from design tokens; text stays ink-coloured; each
  category also has its own shape; at most one mark per sentence and about four per paragraph
  (enforced by Lawdeck, not left to the AI). Lessons open in the full highlighted view (founder:
  "the revision mode works best"); students can switch to Quiet or Off.
- **Revision timing** is Lawdeck's own code (about 1, 3, 7, 14 days, adjusted by results); no library.

## Data (migration 45): one set of records shared by every feature
| Table | Whose | What |
|---|---|---|
| `topic_lessons` | shared, reviewed | one per topic: title, sections with marked phrases and passage ids, version, status |
| `lesson_checkpoints` | shared, reviewed | recall questions: placed after a section (reading) or in the end-of-topic test; MCQ, short, open, authority, statute, principle, sequence; key point; passage ids |
| `lesson_authorities` | shared, reviewed | cases and statutes: citation, court, facts (only from the library), issue, decision, principle, passage ids |
| `study_sessions` | student | one per student, topic and Lagos day: time active, sections read, completed |
| `recall_attempts` | student | every answer, with the question and key point kept even if the lesson changes |
| `review_items` | student | each checkpoint's next due date, interval, successes, lapses |
| `diary_notes` | student | the student's own notes per topic |

The Study Diary is not stored separately: it is assembled from these records, so active recall,
the Diary, "Before you move on" and the retention dashboard always agree.

Rules enforced by the database (tests: `tests/permissions/sql/9u_remembrance_test.sql`):
students see only approved lessons, and only with Lawdeck access; only reviewers write lessons;
any change to an approved lesson (text, checkpoint or authority) sends it back to review; every
learning record is its owner's alone (staff do not read them); one session per topic per day.

## Build order
1. **Phase 1:** 1a database (this) and Admin → Lessons (generate from the library, edit, approve);
   1b lesson reader with recall checkpoints, saved answers and sessions, end-of-topic test and
   report; 1c Study Diary (timeline, entries, filters, notes); 1d "Before you move on" with
   1/3/7/14-day revision.
2. **Phase 2:** mnemonics and acronyms; storytelling (everyday and case stories); saving them.
3. **Phase 3:** Smart Highlighting shown; student annotations; Visual Revision Mode filters.
4. **Phase 4:** adaptive revision timing; retention dashboard (based on recorded recall only,
   not a guarantee of exam results); personalisation.
