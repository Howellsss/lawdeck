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
- Not yet: reading the file's text (2c); an audit-log entry per upload (2e).
