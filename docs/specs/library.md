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
| `search_library` | Approved passages of one course, at most 8 | Also material awaiting review | Same as reviewers | Same as reviewers |
| Search vectors and index details | No | No | No | Write |

Tests: `tests/permissions/sql/40_library_search_test.sql` (15 checks), `tests/unit/retrieval.test.ts` (12 checks), and the browser test that the test page is hidden from visitors.

### Founder steps for 2d

1. Paste `supabase/migrations/20261021000700_library_search.sql` into the Supabase SQL Editor of **lawdeck-dev** and run it. Expected: "Success. No rows returned". Do this before the 2d code goes live.
2. In Vercel: add `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Project Settings > API keys > the secret or "service_role" key) for Production and Preview, marked Sensitive. `VOYAGE_API_KEY` is already there.
3. For the retrieval test on GitHub: add `SUPABASE_SERVICE_ROLE_KEY` and `VOYAGE_API_KEY` as repository secrets (Settings > Secrets and variables > Actions).

