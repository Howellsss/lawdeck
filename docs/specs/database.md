# Database (Phase 1, step 1c)

Rules: System Design §3–4; Engineering Rules E-03, E-06, N-01 to N-03, O-02.
Changes are made only through files in `supabase/migrations/`, applied in name order.

## Tables

| Table | Holds | Who can see or change it |
| --- | --- | --- |
| `profiles` | One row per person (name, campus, role, plan, courses). Made automatically at sign-up. | Only that person. They can edit name, campus and courses; never role or plan. |
| `plans` | Plan names and limits (prices still open). | Signed-in users read. No changes from the app. |
| `courses`, `topics` | The five courses and their topics: names only, no legal content. | Signed-in users read. No changes from the app. |
| `projects` | A student's projects. | Owner only: create, read, rename, delete. |
| `conversations` | Chats (learn or draft), optionally in a project. | Owner only. The database refuses a chat inside someone else's project. |
| `messages` | One turn of a chat. Never edited. | Owner only: read and add. The database refuses a message in someone else's chat. |
| `usage_events` | One row per AI call (tokens, cost, time). | Owner reads. Nothing in the app writes yet; decided in Phase 3. |
| `audit_log` | Sign-ins, approvals, role changes. Never document text. | No student access. |

Visitors who are not signed in can read nothing. Every table has row-level security.
Deleting a project keeps its chats; deleting a chat deletes its messages; deleting an
account deletes all of that person's rows.

## How a migration is applied

1. It is reviewed and merged in a pull request.
2. The founder opens Supabase → SQL Editor → New query, pastes the whole file, and runs it once.
3. Expected result: "Success. No rows returned".
4. The progress log records the date it was applied.

## Tests

See `tests/permissions/README.md`: database rules on a local PostgreSQL (`npm run test:db`)
and the same promises checked on the real project as two test students (`npm run test:permissions`).
