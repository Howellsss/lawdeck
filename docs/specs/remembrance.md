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

## Admin → Lessons (Phase 1a, part 2)
- `/admin/lessons`: every topic of the five courses with its lesson's state; `/admin/lessons/[topicId]`:
  the lesson with its highlights (Full / Quiet / Off), the recall questions placed after each section,
  the end-of-topic test, the authority cards, the library passages used, and the decision (approve,
  reject with a note, withdraw). A reviewer can remove a wrong question or card (the lesson then goes
  back to review).
- Writing a lesson (`POST /api/admin/lessons/generate`, staff only, same-site only, 5-minute limit):
  Haiku lists up to 6 subtopics (`outline-v1`, search phrases only); the library is searched for the
  topic (14 passages) and each subtopic (6), up to 40 passages; Opus writes the lesson (`lesson-v1`,
  structured reply checked by `lessonReplySchema`). Before saving, `cleanLesson` runs the citation
  check on every paragraph, card and question; drops authorities the library cannot confirm and any
  question naming one; drops broken multiple-choice questions; keeps case facts only if the library
  gives them; places highlights within the calm limits (`src/lib/lessonMarks.ts`). Saved as "awaiting
  review". Rewriting replaces the questions, so students' revision for that topic restarts.
- Cost: about US$0.20–0.50 per lesson (Opus), once per topic. Staff-only, so it is not counted
  against any student's questions; every call is logged with model, tokens and cost.
- Tests: `tests/unit/lessonMarks.test.ts`, `tests/unit/lessonClean.test.ts`, e2e (pages and the
  writing route refuse visitors).

## Studying a topic (Phase 1b)
- Course page: topics with an approved lesson show **Study** (black button) before Explain and MCQ.
- `/study/[topicId]`: the approved lesson with highlights (opens Full; Quiet / Off remembered on the
  device). With "Questions while reading" on (default; remembered on the device), the lesson opens a
  section at a time; after a section that teaches something worth remembering, its recall questions
  appear and "Continue reading" opens once they are answered or skipped. Off shows the whole lesson.
- Answers never reach the browser before an attempt: the page receives questions without answers;
  `revealAnswer` (needs a written attempt or a skip) and `recordAnswer` return them. Multiple choice
  is marked on the server; for written answers the student compares with the model answer and marks
  Got it / Partly / Missed it (no AI cost).
- Every answer is saved (`recall_attempts`) and sets the question's revision date (`review_items`,
  `src/lib/revision.ts`: about 1, 3, 7, 14, 30, 60, 120 days; partly right repeats the step; a miss
  starts again tomorrow; a first answer while learning always comes back tomorrow).
- One study session per topic per day: opening the lesson again the same day continues it, from the
  section reached; active reading time is saved every minute and when the page is hidden.
- Case and statute names in the text open their authority card in the side panel (citation, court,
  facts only from the library or "verification required", issue, decision, principle, library source).
- End-of-topic test: one question at a time, then a report (answered, correct, partly, missed or
  skipped; remembered well; worth revisiting; authorities struggled with), with "Try the missed
  questions again". The session is marked finished. The report says it is based on these answers
  only, not a prediction of exam results.
- Tests: `tests/unit/revision.test.ts`; `tests/voice/lesson.spec.ts` (test-only lesson page: highlight
  modes, mark caps, no answer shown before trying, no sideways scroll at 360 px and desktop); e2e:
  `/study/[id]` asks visitors to sign in; the test page does not exist on the live configuration.
