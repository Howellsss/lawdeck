# Library (Phase 2)

System Design §2.5, §3 (kb_items, kb_passages) and §4; Engineering Rules H (knowledge base), E-04 (retrieval permissions).

## Step 2a: database and file store

| Part | Holds | Students | Reviewers | Admins |
| --- | --- | --- | --- | --- |
| `kb_items` | One row per source file: title, type, course, topics, campus, year, source, file details, review status, reviewer, review date, "law current as of" | Approved items' details only (for the Sources panel) | See all; change review status, note and currency date only | Everything |
| `kb_passages` | Searchable pieces of each item (heading, text, pages, search vector, model) | **No direct access**, even when approved. Answers use passages on the server (Phase 3) | Read all; correct heading and wording | Add and remove |
| `library` file bucket | Original files (PDF, DOCX, PNG, JPEG; ≤ 25 MB) | No access | Read | Add, replace, remove |

- Changing the review status records who did it and when, automatically.
- A withdrawn or rejected item disappears for students at once.
- Removing an item removes its passages.
- Search vectors are written only by the marked admin job (step 2c/2d), never from the screens.
- Students will search through one database function that returns a few approved passages at a time (step 2d), so the library can't be copied out wholesale.

Tests: `tests/permissions/sql/20_library_test.sql` (26 checks) and the "library" part of `tests/permissions/workspace.test.ts` on the real project.

## Founder steps

1. Paste the two migrations in the Supabase SQL Editor, in order:
   `supabase/migrations/20261021000400_library.sql`, then `supabase/migrations/20261021000500_library_storage.sql`.
2. Make your own account an admin. In the SQL Editor, replace the email and run:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
   ```
   Expected: "Success. 1 row affected". Reviewers are made the same way with `'reviewer'`.

## Step 2b: admin upload screen (`/admin/library`)

- Reached from "Library" in the left menu, shown only to reviewers and admins. The page checks the role on the server; anyone else sees "Page not found" and no library content.
- Admins upload one file with its details: title, type, course, year, campus, source. Reviewers see the list but cannot upload or remove.
- How a file travels: the server checks the details and the role, then gives the browser a one-time link; the file goes straight into the private `library` store (Vercel cannot carry 25 MB). The server then reads the file's first bytes to check its real type (`src/lib/libraryFiles.ts`), and only then records the item as "awaiting review". A mismatched file is deleted with a clear message.
- Files from interrupted uploads (no item, older than an hour) are removed the next time anyone uploads to that course.
- Removing an item deletes its passages (database) and its file (store), after a confirmation.
- Not yet: an audit-log entry per upload (2e).

## Step 2c: reading files into passages

- After an upload, the page reads the file straight away. Admins can also "Read file", "Continue reading", "Try again" or "Read again" from the list.
- How each file is read (`src/server/library/extract.ts`, `src/server/ai/transcribe.ts`):
  - PDF with text: page by page with the `unpdf` library. A page with fewer than 40 letters or digits is treated as a scan.
  - Scanned PDF pages and photos: Claude (`MODELS.transcribe`, Haiku 5.5) copies the text, three pages per call, under the versioned instructions in `src/prompts/transcribe.ts`. Headings are marked "# ", and anything unreadable is marked `[unreadable]`. The file is marked for caching so later batches cost less. Each call's model, tokens, cost and time are logged, never the text.
  - Word (DOCX): the `mammoth` library, which keeps the real heading styles. Word files have no fixed pages, so the page is left blank.
- Long scans are read in steps of up to about 2½ minutes (the page allows 5). Page text is kept in `kb_item_pages`, so reading can carry on after a break and reviewers can compare passages with the page.
- Splitting (`src/server/library/split.ts`): passages of 300–800 words. A heading always stays with the text after it, and a new heading starts a new passage once the current one is long enough. A long section keeps its heading on each part, and a very long paragraph is broken at sentence ends. Each passage records its first and last page.
- PDF headings are guessed from the line's shape (short lines in capitals; "Part", "Chapter", "Order", "Rule", "Section", "Article", "Schedule" with a number; short numbered lines). Reviewers can correct them in 2e.
- The new passages replace the old ones in one database step (`replace_kb_passages`), which also records the method (text, scanned or both), quality (share of pages with at least 20 readable words), page count and time. Search vectors are added in 2d.
- Limits: a PDF with scanned pages must be under about 22 MB, because Claude accepts at most 32 MB per request. Larger scans must be split into smaller files.

| Part | Students | Reviewers | Admins |
| --- | --- | --- | --- |
| `kb_item_pages` (text of each page) | No access | Read | Add, remove |
| Reading details on `kb_items` | Not shown | See; cannot change | Change |
| `replace_kb_passages` | Refused | Refused | Allowed |

Tests: `tests/permissions/sql/30_library_reading_test.sql` (17 checks), the "library" part of `tests/permissions/workspace.test.ts`, and `tests/unit/libraryReading.test.ts` (20 checks, using two made-up sample files in `tests/fixtures`).

### Founder step for 2c

Paste `supabase/migrations/20261021000600_library_reading.sql` into the Supabase SQL Editor and run it. Expected: "Success. No rows returned". This must be done before the 2c code goes live, or the Library page will show an error.

## Step 2d: search

- **Search vectors** come from Voyage AI (`src/server/retrieval/voyage.ts`; model setting in `src/server/retrieval/settings.ts`, currently `voyage-4` until the test picks one). Each passage is indexed as its heading plus its wording, and the model name is stored with every vector.
- **Indexing** is a marked admin job (`src/server/retrieval/indexJob.ts`) using the service-role key, because nobody signed in may write search vectors. It runs straight after a file is read; admins can also click "Index for search" on an item. Like reading, it works in steps and can carry on after a break. The list shows "Indexed for search: all N passages" or what is missing. Reading a file again clears its index count, because the new passages have no vectors yet.
- **Searching** goes through one database function, `search_library` (migration 7). It filters first (chosen course; approved items only, or also items awaiting review for reviewers and admin jobs), then ranks two ways: by meaning (only vectors from the same model are compared) and by exact words (English word stems, so section numbers and case names count). The two rankings are combined by reciprocal rank fusion (k = 60, top 40 each), and at most 8 passages are returned. If Voyage cannot be reached, the search still works on exact words and says so.
- **Test page** `/admin/library/search` (reviewers and admins): ask a question, choose a course, see the passages with their item, pages and how each was found. Students will search only through answers in Phase 3.
- **Retrieval test** (`tests/eval/retrieval`): compares the two models on the 30 Civil Litigation questions. Results are recorded in `docs/specs/retrieval-eval.md`.

| Part | Students | Reviewers | Admins | Admin jobs (service key) |
| --- | --- | --- | --- | --- |
| `search_library` | Approved passages of one course, at most 30 to the server (8 shown or sent to the AI); 40 searches an hour, 200 a day | Also material awaiting review | Same as reviewers | Same as reviewers |
| Search vectors and index details | No | No | No | Write |

Tests: `tests/permissions/sql/40_library_search_test.sql` (15 checks), `tests/unit/retrieval.test.ts` (12 checks), and the browser test that the test page is hidden from visitors.

### Founder steps for 2d

1. Paste `supabase/migrations/20261021000700_library_search.sql` into the Supabase SQL Editor of **lawdeck-dev** and run it. Expected: "Success. No rows returned". Do this before the 2d code goes live.
2. In Vercel: add `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Project Settings > API keys > the secret or "service_role" key) for Production and Preview, marked Sensitive. `VOYAGE_API_KEY` is already there.
3. For the retrieval test on GitHub: add `SUPABASE_SERVICE_ROLE_KEY` and `VOYAGE_API_KEY` as repository secrets (Settings > Secrets and variables > Actions).

## Drive import (founder request, 2026-10-21)

- Admins see "Import from Google Drive" on the Library page once Google is set up. Google's own file picker opens; the admin chooses several files (PDF, Word, PNG, JPEG), checks the suggested details for each and clicks Import.
- Suggestions come from the file name (`src/lib/driveGuess.ts`): the course whose distinctive word is in the name (one spelling slip allowed, e.g. "Cooporate"), the year, and a tidy title. Type starts as "Course material". Nothing is imported until the admin confirms.
- Access: only Google's `drive.file` permission (the files picked, nothing else), for about an hour. The short-lived token goes to Lawdeck's server for that import only and is never stored or logged.
- The server fetches each file (`src/server/library/drive.ts`), with the same checks as an upload: admin role, details, real file type, 25 MB limit (the download stops as soon as it passes 25 MB). Google Docs/Sheets/Slides are refused. A file already in the course (same name and size) is skipped. It is stored in the private library store, recorded "awaiting review", then read and indexed like an upload.
- Google's scripts (`accounts.google.com/gsi/client`, `apis.google.com/js/api.js`) load only when an admin clicks the button (approved by the founder, 2026-10-21).

Tests: `tests/unit/driveImport.test.ts` (10 checks).

### Founder steps for the Drive import (Google Cloud, same project as Google sign-in)

1. APIs & Services > Library: enable **Google Picker API** and **Google Drive API**.
2. APIs & Services > Credentials > Create credentials > API key. Restrict it: Websites `https://mylawdeck.com/*` and `https://lawdeck.vercel.app/*`; APIs: Google Picker API. Copy it.
3. Credentials > the OAuth "Web client" used for sign-in: add `https://mylawdeck.com` (and `https://lawdeck.vercel.app`) under Authorised JavaScript origins. Copy its Client ID.
4. OAuth consent screen (Google Auth Platform) > Data access > Add scopes: `.../auth/drive.file`.
5. Dashboard > Project info: copy the Project number.
6. Vercel > Environment Variables (Production and Preview): `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`, `NEXT_PUBLIC_GOOGLE_APP_ID`. Then redeploy.


## Step 2e: reviewer console (`/admin/library/[id]`)

- Every item in the Library list has **Review**. The list can be filtered: All, Awaiting review, Approved, Rejected, Withdrawn.
- The review page shows the item's details, reading and search state, a **Decision** panel and its passages, 20 per page with page numbers.
- **Decision:** Approve, Reject, Withdraw, or back to Awaiting review; a "law current as of" date (required to approve, not in the future; rule KB-02) and an optional note.
- **Approval rules, enforced by the database (migration 8):** the file must be read, every passage indexed for search, and the date given. The screen explains what is missing; the database refuses anything that breaks the rules anyway.
- **Correct a passage:** reviewers fix a heading or wording in place. The database clears the passage's old search vector and marks the item as not fully indexed; Lawdeck re-indexes the passage straight away (marked admin job). If Voyage AI is busy, the correction is still saved and an admin finishes it with "Index for search".
- **Audit record (audit_log), written by the database:** item added, item removed, each decision (from, to, date, whether the note changed), each correction (which passage). Never document text. Nobody can read or write it from the app.
- Reviewers still cannot upload, remove, read files or change an item's details.

Tests: `tests/permissions/sql/50_library_review_test.sql` (16 checks); approvals in earlier test files now prepare items to meet the rules first (`test.make_reviewable`).

## Step 2f: out-of-date warning (`/admin/library/law-changes`)

- Reviewers and admins record **changes in the law**: what changed, the course, the date it took effect, and an optional source and note. They can remove a record; all of this goes into the audit record.
- An item **needs re-checking** when a recorded change in its course took effect after the item's "law current as of" date. The database works this out live (view `kb_items_needing_recheck`, migration 9), so it is never stale.
- The Library list shows "Needs re-check: …" on such items and has a **Needs re-check** filter with a count. The review page lists the changes that triggered it and what to do.
- Saving a newer "law current as of" date clears the warning. Nothing is withdrawn automatically: a reviewer decides.
- Students and visitors cannot see law changes or the warnings.

Tests: `tests/permissions/sql/60_law_changes_test.sql` (13 checks).

## Re-ranking and the search limit (migration 10)

- **Why:** the retrieval test showed the right passage was not always in the top 8 (34/35). Voyage's re-ranker, reading the top 30, put it in the top 8 for 35/35 and the top 5 for 35/35 (`docs/specs/retrieval-eval.md`).
- **How:** `search_library` now returns up to 30 candidates to the server. `src/server/retrieval/search.ts` sends them with the question to Voyage `rerank-2.5` (`src/server/retrieval/rerank.ts`; setting `RERANK_MODEL`) and keeps the best 8. It waits at most 5 seconds; if the re-ranker fails or is slow, the search keeps its own order, logs it, and the test page says so. Each call logs model, tokens, cost and time, never text. Cost: about $0.001 per search.
- **Copy protection:** students may search 40 times an hour and 200 times a day (database rule, `search_events` table with row-level security: people see only their own searches; nobody can add or delete them directly). Reviewers, admins and the marked admin jobs are not limited. The screen and the AI still get at most 8 passages.
- **Tests:** `tests/permissions/sql/70_search_limit_test.sql` (12 checks), `40_library_search_test.sql` updated to the 30 cap, `tests/unit/search.test.ts` and `rerank.test.ts`. The retrieval test now checks the live search: every question in the top 8 and all but one in the top 5.

Founder step: paste `supabase/migrations/20261021001000_search_rerank.sql` into the Supabase SQL Editor of **lawdeck-dev** and run it.

## Out-of-date material and the archive of originals (migration 11)

- **Out of date means out of search for students.** When a reviewer records a law change, approved items in that course checked only up to an earlier date ("Needs re-check") are left out of student search straight away, inside `search_library`. They come back when a reviewer saves a "law current as of" date on or after the change. Reviewers and the admin jobs still find them, so they can check them. Screens say "hidden from students".
- **What this cannot catch:** approved material that is out of date with no law change recorded. The legal reviewer must record changes as they happen.
- **Archive of originals (rule Q-03).** A separate private store, `library-archive`, keeps each item's original file under its content fingerprint (`course/item/sha256.ext`). Admins may add and read; nobody, admins included, can overwrite or delete (no such rule exists). The reading step archives a file before reading it, once per item, and records `kb_items.archive_path` (admins only, write-once). The archive is never read, split, indexed or searched. Files read before migration 11 are archived by the one-off admin job `jobs/archive-originals.job.ts` (GitHub Actions, "Archive library originals").
- **Tests:** `tests/permissions/sql/80_recheck_and_archive_test.sql` (14 checks), `tests/unit/archive.test.ts`.

Founder step: paste `supabase/migrations/20261021001100_recheck_and_archive.sql` into the Supabase SQL Editor of **lawdeck-dev** and run it.
