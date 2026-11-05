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

## Study Diary (Phase 1c)
- Side menu: **Study Diary** (`/diary`). Nothing is stored for the diary itself: it is assembled from
  `study_sessions`, `recall_attempts`, `review_items`, the lessons' authorities and `diary_notes`
  (`src/server/db/diary.ts`), so it always matches recall and revision.
- Dashboard: topics studied, topics completed, time studying, recall accuracy (answers only, never
  time; labelled "not a prediction of exam results"), points due for revision now, and upcoming
  revision by topic.
- Timeline: newest day first; each entry shows course, minutes, recalled out of answered, completed,
  and revision status. Filters (in the address, plain form): course, topic, from/to dates, case or
  statute name, revision status (`src/lib/diaryFilter.ts`).
- Entry (`/diary/[sessionId]`): what I studied (sections, important concepts), authorities (with
  principle and library source), remembrance tools (Phase 2 adds memory aids), recall performance
  (each question and how it went), what to revisit (missed points and the topic's revision schedule),
  and **My notes** (one note per topic, saved; `saveDiaryNote`).
- Tests: `tests/unit/diaryFilter.test.ts`; `tests/voice/diary.spec.ts` (layout at 360 px and desktop);
  e2e: `/diary` and entries ask visitors to sign in; the test page does not exist on the live
  configuration. Privacy: covered by the database tests (every record is its owner's alone).

## Before you move on (Phase 1d)
- When questions are due (`review_items.due_at` passed), the home page and the top of a study
  page show "Before you move on… Yesterday, you studied {topic}. Let's see what you still
  remember." with a button to `/revise`. It never blocks: new study is always one click away.
- `/revise` asks up to 10 due questions (oldest due first), one at a time, with the same recall
  card as the reader (answer hidden until the student tries). Each answer is saved with context
  `revision` and reschedules the point: remembered points move to the next step (1, 3, 7, 14, 30,
  60, 120 days); missed or partly remembered points come back the next day.
- At the end: how many were remembered, a refresher link to each topic with a missed point, and
  "Continue to today's study". "Stop here" is always there; unanswered questions stay due.
- No AI cost: multiple choice is marked by Lawdeck, written answers self-marked.

## Writing and approving many lessons (founder, 2026-11-05)
- **Write all missing lessons** (Admin → Lessons): for all courses or one, writes every topic that
  has no lesson, 2 at a time, through the same route as a single lesson. Shows the estimated cost
  (US$0.20–0.50 a lesson) and asks first; lists failures with "Try again". The page stays open
  while it runs. Lessons already written are never rewritten.
- **Approve all awaiting review** (per course): approves that course's pending lessons and marks
  them `bulk_approved` (migration 46). Students see "Not yet read in full by a reviewer" and
  Report a problem (report kind `lesson`). A reviewer who reads one clicks "I have read it in
  full" to clear the mark. Any later change sends it back to review, unmarked.
- **Reminder:** next, "skim, tick and approve": a quick "Looks right" tick per lesson and
  "Approve all ticked", so every lesson is looked at once before students see it unmarked.

## Memory aids and stories (Phase 2a)
- **Data (migration 47):** `lesson_extras` (one set per lesson, its own review state and
  `bulk_approved` mark), `lesson_memory_aids` (acronym, phrase, association, pattern: title,
  device, what each letter or word stands for, explanation, sources) and `lesson_stories`
  (everyday or case: parts, takeaway, an optional multiple-choice question, sources). Kept beside
  the lesson, so writing them never sends an approved lesson back to review. Students read them
  only when both the set and its lesson are approved (`lesson_extras_readable`). Removing an aid or
  story sends the set back to review; a change to the lesson's wording does too.
- **Writing** (`src/server/lessons/extras.ts`, prompt `extras-v3`, Opus): from the lesson, its
  authority cards and the same library passages. Lawdeck's own limits (`src/lib/extrasRules.ts`):
  one aid per section, at most 4 aids and 3 stories; an acronym is kept only if its items spell
  it; a case story only for an authority whose facts the library gives; then the citation check
  on every piece of text. About US$0.10–0.25 a lesson.
- **Admin → Lessons:** "Write memory aids and stories for every lesson" (bulk, like lessons),
  "Approve N memory aid sets" per course (marked, like lessons), and on each lesson's page the
  aids and stories with Remove, Rewrite and the decision.
- **Test:** `tests/eval/extras.eval.ts` ("Memory aids test" workflow; runs when the instructions
  or rules change): a made-up lesson, checked for an aid with all five conditions, acronyms
  spelled by their items, no case story without library facts, no number or case the material
  does not give, an everyday Nigerian story, and the limits.
- **2b** (below): students see them in the lesson, save the ones they like, and saved aids appear in the Study Diary.
  story"), save the ones they like, and saved aids appear in the Study Diary.

## Keeping lessons up to date (founder, 2026-11-05)
- **One process:** writing a lesson (single or bulk) writes its memory aids and stories straight
  after (bulk: "Also write each lesson's memory aids and stories", on by default; the cost shown
  includes them). If the aids fail, the lesson stays written and the reason is listed.
- **Versions (migration 48):** writing a lesson that is already approved adds a new version
  beside it. Students keep reading the approved version until a reviewer approves the new one;
  the database then withdraws the old one (`replaced_by`) and ends students' revision of its
  questions (revision restarts with the new questions). At most one approved and one working
  version per topic. Replaced versions are kept for the Study Diary.
- **New library material:** when a reviewer approves a library item, Lawdeck checks (after the
  page has answered) which topics' lessons it is about, using the same search lessons are written
  from (top 14, no re-ranking), and marks them (`new_material_at`). Admin → Lessons shows "new
  library material" on those topics and an "Update N lessons with new library material" panel.
  Nothing is rewritten automatically: each update costs money and needs review.

## Memory aids and stories for students (Phase 2b)
- **In the lesson:** after each section, its memory aid (with every letter or word explained and a
  "Save" button) and "Read it as a story: …" buttons. Stories open on request; everyday stories
  are labelled "Illustration, not a real case", case stories name the case. A story's quick
  question is marked on the server after the student chooses (the right answer is not sent
  before). Aids and stories show whether or not questions while reading are on.
- **Saved aids (migration 49, `saved_memory_aids`):** each student's own; the database copies the
  aid (only one the student can read), so saved aids survive lesson updates. At most 500. Shown
  as "Your saved memory aids" on the topic and under "My remembrance tools" in the Study Diary
  entry; removable from either.
- **2c** (below): "Another memory aid" and "Tell it another way" on request.

## On request (Phase 2c)
- **"Another memory aid"** under each aid and **"Tell it another way"** in each open story. Made
  by Sonnet (`MODELS.memoryAids`, prompt `again-v1`) from the student's approved lesson and its
  authority cards (students cannot read library passages; the lesson comes from them and was
  reviewed), then the citation check against the whole library. Lawdeck's own rules
  (`src/lib/againRules.ts`): the new aid covers exactly the same points (same number, an acronym
  spelled by its items); a retold story keeps its kind and, for a case, the same case.
- **One question each** (founder, 2026-11-05): checked before the call, recorded as
  `memory_aid` (migration 50) only when the result is delivered; a result that fails the checks
  does not use a question.
- **Saving:** an aid made for the student can be saved, marked "Made for you" (migration 50:
  `made_for_me`; an aid from a lesson is still copied from the aid itself).
- **Test:** `tests/eval/again.eval.ts` (in the "Memory aids test" workflow).

## Students' own marks (Phase 3a)
- **Marking:** in a lesson, the student selects words (within one paragraph, up to 500
  characters); a bar at the bottom offers Highlight, Circle, Underline and a note. Tapping a mark
  (or its ✎ note marker) reopens the bar to change the look, edit the note or remove it. Saved
  straight away.
- **Look (founder, 2026-11-05: option B):** one look for all student marks, in ink rather than a
  colour, always dashed (`.ann-*` in globals.css), so they never look like Lawdeck's highlights.
  Shown in every highlight view (Full, Quiet, Off).
- **Data (migration 51, `lesson_annotations`):** each student's own; the place (section, paragraph,
  characters) and the words themselves, on a lesson the student can read; at most 3,000 a student.
- **Lesson updates:** a mark is placed where it was if its words are still there, else the same
  words elsewhere in the lesson (`src/lib/annotations.ts`); if the words are gone, it is listed as
  "Your marks from an earlier version", never lost.
- **3b** (below): Visual Revision Mode, with "my marks" as one of its filters.

## Visual Revision Mode (Phase 3b)
- **Where:** "Revise visually: only the key points" on each topic's study page, and "Revise
  visually" in each Study Diary entry (`/study/<topic>/visual`).
- **What:** every marked point of the topic in reading order, each shown in its own sentence
  (`src/lib/visualRevision.ts`): Lawdeck's highlights in their colour and shape, and the student's
  own marks in their ink look, with their notes.
- **Filters:** cases, statutes, principles, definitions, exam tips, exceptions, my marks; tick to
  show or hide, "only" to show one kind. Case and statute names open their card in the side panel;
  "Read it in the lesson" opens the lesson at that section (`#lesson-section-N`).
- No AI and no new data: it reads the lesson and the student's marks.
