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
