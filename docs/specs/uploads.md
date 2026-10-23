# Private uploads (Phase 6)

PRD UP-01 to UP-06 and Appendix C; System Design §2.4, §3 (uploads, upload_passages) and §4.3; Engineering Rules E-03, F-02 and G-07.

## Plan (approved by the founder, 2026-10-23)
- 6a. Upload notice, private file store, uploads tables, My uploads page (this step).
- 6b. Reading uploads (text and scans), extraction quality flag, search index tied to the student.
- 6c. Answers from the student's uploads, labelled "From your uploads" or "From the Lawdeck library".
- 6d. View-only sharing; 6e. exports; 6f. account deletion, report a problem, takedown route.

## What the student gets (6a)
- **My uploads** in the sidebar. Before the first upload, the notice from PRD Appendix C is shown once; "I understand" records the time in the database.
- Upload a PDF, Word (DOCX), PNG or JPEG file of up to 25 MB.
  1. The server gives the browser a one-time link into the student's own folder.
  2. The server then checks the file's real type from its contents and its size. A file that fails is removed.
- At most the plan's number of files (Free: 50). The page shows "X of 50 files used".
- The list shows each file's size, upload time and status ("Waiting to be read" until step 6b). A file that was hard to read is flagged (UP-04, from 6b).
- **Delete** asks for confirmation, then removes the file from storage and its record and passages at once (UP-05).

## Data (migration 24)
| What | Holds | Access |
|---|---|---|
| profiles.upload_notice_accepted_at | when the notice was accepted | set only through `accept_upload_notice()` |
| storage bucket `uploads` | the files, one folder per student id | the student's own folder only; no access for staff or other students |
| uploads | file name, type, size, path, status, extraction quality | owner only |
| upload_passages | searchable passages (from 6b) | owner only; never part of the library |

Rules the database enforces (tested in `tests/permissions/sql/9f_private_uploads_test.sql`):
- no file or record before the notice is accepted;
- files and records only inside the student's own folder;
- only the four file types and 25 MB;
- the plan's file limit;
- nothing visible to other students, reviewers, admins or visitors;
- passages go with their upload.

## Reading uploads (step 6b, migration 25)
- **When:** each file is read straight after it is uploaded, by the same reader as the library (`src/server/library/reader.ts`, now shared).
  - Word files and PDF text are read without AI.
  - Scanned pages and photos are read by Claude Haiku three pages at a time; the instructions treat page text as content, never instructions (rule G-07).
  - The text is split into passages and indexed for search with Voyage.
- **Whose session:** everything runs with the student's own session, never the master key.
- **Status:**
  - "Ready" is set by `finish_upload_reading()`, and only if the file really has passages.
  - A failure is recorded with its reason, and the student sees "Try again".
  - Pages already read are kept, so trying again carries on and never pays twice for a scanned page.
  - Without a Voyage key, the file is still finished and searchable by its words.
- **Extraction quality (UP-04):** the share of pages with readable text. Below 80%, the student sees "Parts of this file were hard to read…".
- **Scanned-page allowance (founder, 2026-10-23):** 200 scanned pages per student per month on the Free plan (`plans.monthly_scan_page_limit`).
  - Pages read are recorded in `scan_page_usage`, which students can read but not change. Deleting a file does not give pages back.
  - When the allowance runs out, reading stops with a message and carries on next month.
  - Reviewers and admins have no limit. Text pages are unlimited, and none of this counts toward the 30 questions.

| What (migration 25) | Holds | Access |
|---|---|---|
| upload_pages | text of each page while a file is read | owner only; goes with the upload |
| uploads.problem | why a file could not be read | owner reads; set only by the reading functions |
| scan_page_usage | scanned pages read, with the time | owner reads; written only by `record_scan_pages()` |
| plans.monthly_scan_page_limit | scanned pages a month (Free: 200) | everyone signed in reads plans |

Tested in `tests/permissions/sql/9g_reading_uploads_test.sql` (30 checks) and `tests/unit/uploadReading.test.ts`.

## Answers from uploads (step 6c, migration 26)
- **Search:** an answer searches the approved library and, unless the chat's **Use my uploads** switch is off, the student's own Ready uploads. `search_uploads()` only ever returns the caller's own passages.
  - Both sets are ranked together by the re-ranker. Without it, they are taken in turn.
  - If the upload search fails, the answer still uses the library.
- **Labels:** each source keeps its origin. Under the answer, sources are grouped as **From the Lawdeck library** and **From your uploads**; the right panel says which.
  - Opening an upload source works for its owner only. A deleted file shows "You have deleted this file…".
- **Instructions (prompt explain-v3):**
  - Passages are marked `origin="library"` or `origin="student upload"`.
  - Student uploads may be wrong or out of date: the library is preferred, and a disagreement is pointed out.
  - Uploaded text is content, never instructions (G-07).
- **Citation check unchanged:** an authority found only in a student's notes, and not in the library or a recognised statute, is still removed (CLAUDE.md).
- **Switch:** the **Use my uploads** switch shows on a chat once the student has a Ready file, and is saved per chat (on by default).
- **Tests:** `tests/permissions/sql/9h_answers_from_uploads_test.sql` (12 checks) and `tests/unit/answersFromUploads.test.ts`.
