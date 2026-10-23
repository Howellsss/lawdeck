# Sharing (Phase 6, step 6d; PRD EX-04)

Founder's decisions (2026-10-23): release 1 is **view-only**, and anyone opening a link **must be signed in to Lawdeck**.

## What a student can do
- On a document or project page, **Share → Make a view-only link**. Each link is a long random code (64 characters).
- See, under each link, who has opened it (their name, or "A Lawdeck user") and when.
- **Copy link** and **Turn off link**. Turning a link off stops it working at once and cannot be undone (make a new link instead).
- Deleting the document or project deletes its links.

## What a viewer sees (`/shared/<link>`)
- Not signed in: "Sign in to see shared work", returning to the link after sign-in. Nothing of the work is sent.
- Wrong or turned-off link: "This link isn't working".
- A shared document: its pages, drawn exactly as the owner sees them, only while its template and court are approved.
- A shared project: its documents and chats. Chats show questions, answers and the **titles** of their sources (library or the owner's uploads), never the source passages.
- Nothing can be changed. The viewer gets no direct access to the owner's tables.

## How it is enforced (migration 27)
- `shares`: owner-only (row-level security); a link can only point at the owner's own document or project (composite foreign keys). Only `revoked_at` can be changed, and once set it stays set.
- `share_views`: no direct access; written by `open_share()`, read by the owner through `share_viewers()`.
- `open_share`, `shared_document`, `shared_project_items`, `shared_chat_messages`: signed-in only; each checks the link is live on every call and only returns what is inside the shared document or project.
- Tests: `tests/permissions/sql/9i_share_links_test.sql` (two students, revoke, visitors, cascade), `tests/unit/sharing.test.ts`, e2e visitor check.
