# Projects and chats (Phase 1, step 1d)

PRD WS-05; Build Phases Phase 1 ("Projects: create, rename, delete; chats listed in the left pane").

## What students can do

| Where | What |
| --- | --- |
| `/projects` | See their projects (newest first), create one by naming it. Empty state when there are none. |
| `/projects/[id]` | See the project's chats; rename it; delete it after a confirmation. Deleting keeps its chats (they leave the project). |
| Left menu, Recents | Their 20 latest chats. Visitors see "Sign in to keep your chats." |
| `/chats/[id]` | Read a saved chat. Asking and answering arrive in Phase 3. |
| `/courses` | The five courses, read from the database. |

Signed-out visitors get "Sign in to see your …" with a link that returns them to the same page.
Another student's project or chat looks exactly like one that does not exist (not found).

## How it is built

- Reads: `src/server/db/workspace.ts`. Changes: `src/server/projects/actions.ts`. Both check sign-in on the server first; row-level security is the final guard.
- Names are checked with Zod (`src/schemas/projects.ts`): spaces tidied, 1–120 characters. Ids must be UUIDs before any database call.
- Database column types live in `src/server/db/types.ts` and must change with every migration.
- Dates are shown in West Africa Time (`src/lib/dates.ts`).
- Chats are not created yet: a chat starts when Lawdeck can answer (Phase 3).
