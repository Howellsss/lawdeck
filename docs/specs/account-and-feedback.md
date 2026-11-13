# Account deletion, problem reports and takedowns (Phase 6, step 6f)

Founder approved 2026-10-23. PRD AC-05, FB-01, FB-03. Migration 28.

## Delete account (AC-05) — step 6f-1
- **Account** page (`/account`), opened from the student's email at the bottom of the sidebar.
- "Delete my account" opens a warning and asks the student to type `DELETE`.
- The server removes the student's uploaded files (their own folder, with their own session), then calls `delete_my_account('DELETE')`. The database refuses while any of their files remain, then deletes the account; every student-owned table is removed with it (all are `on delete cascade`). Items the student reviewed keep their content and lose only the reviewer's name (`on delete set null`).
- Deletion is immediate (the PRD allows up to 30 days). Payment records do not exist yet; when they do, any the law requires us to keep will be kept separately.
- Reviewer and admin accounts cannot delete themselves; the founder removes them.
- No service-role key is used.

## Report a problem (FB-01) — step 6f-2
- Screens: "Report a problem" under every answer, document, brief and practice question (five choices, optional note). Reviewers: Admin → Reports, with what was reported, "Mark resolved" or "Open again".
- `problem_reports`: answer, document, brief or practice question; category wrong law, outdated, unclear, formatting or other; optional note up to 500 characters.
- A student can report only their own work (checked by the database), at most 50 reports a day, and sees only their own reports. Reviewers see all reports, with what was reported (`problem_report_context`, cut at 4,000 characters), and mark them resolved; the database records who and when.

## Takedown requests (FB-03) — step 6f-2
- Screens: public `/takedown` form (linked from the sign-in page), with a hidden spam trap. Reviewers: Admin → Takedowns, open requests oldest first with their due date (overdue shown), "Mark done" or "Open again".
- Anyone can submit through `submit_takedown(name, email, material, reason)`: length-limited, real-looking email, at most 30 requests an hour across everyone.
- Only reviewers can read requests (they hold names and emails) and mark them done; the team acts within 7 days of `created_at`.

## Tests
`tests/permissions/sql/9j_account_reports_takedowns_test.sql` (30 checks) · `tests/unit/deleteAccount.test.ts` · e2e visitor check for `/account`.

## Accepting the Terms of Service and Privacy Notice (migration 67, founder approved 2026-11-13)
- The documents are Lawdeck's own pages, /terms and /privacy (docs/specs/legal-pages.md). On from the start.
- Sign-up: a required tick box, "I am 18 or over, and I agree to Lawdeck's Terms of Service and Privacy Notice" (checked on the server). The accepted version is kept with the new account and recorded at first sign-in.
- Everyone else signed in (Google sign-in, existing students, or anyone after the documents change) sees "Before you continue" once and must tick and accept.
- `terms_acceptances`: who, which version (`TERMS_VERSION` in `src/lib/terms.ts`), and when (set by the database). Own rows only; admins read all as evidence; nobody changes or deletes a record; removed with the account.
- When either document changes (its `updated` date in `src/templates/policies`), set `TERMS_VERSION` to the new date: everyone accepts again, once.
- Tests: `tests/permissions/sql/9zp_terms_acceptances_test.sql`, `tests/unit/termsAcceptance.test.ts`, `tests/voice/terms.spec.ts`.

