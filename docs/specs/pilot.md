# The closed pilot (Phase 8)

Approved by the founder, 2026-10-23: all six pilot tools. Building them costs nothing; running the pilot uses AI (see the funding request).

## Invitations (8.1), migration 32
- **Settings (Admin → Pilot):** **Invite only** on or off, stored in `pilot_settings`.
- **While it is on:**
  - a student without a redeemed code has 0 questions (`question_allowance`) and 0 scanned pages (`scan_pages_left`), so nothing they do costs money;
  - under the question box they read: "Lawdeck is in a closed pilot. If you have an invite code, enter it on your Account page to start."
  - reviewers and admins are not affected.
- **Codes:**
  - The admin creates a code for each group, with a name, how many students may use it (1–500) and an optional end (1–90 days).
  - Each code is 10 characters from 31 easy-to-read letters and digits, about 8 × 10^14 possibilities, made with secure random numbers.
  - The admin can switch a code off. Used codes cannot be deleted.
- **Redeeming:** the student enters the code on **Account → Join the pilot**. `redeem_invite()` checks the code, counts the use, and records `pilot_access_at` and the redemption. Students never see the codes table.

## The weekly review and measures (8.2, 8.3)
- **Admin → Pilot** shows, for the last 6 Lagos weeks (from `pilot_metrics`):
  - active students;
  - questions per student;
  - AI cost in dollars and naira, and per student;
  - documents drafted;
  - new pilot students;
  - problem reports.
- **The exit checklist figures** (from `pilot_summary`):
  - the share of students still active in their 4th week (target 40%);
  - the share who would pay the tested price (target 15%);
  - open problem reports, with links to Reports and Answer tests.
- **Counts only, never names.** Reviewers and admins are left out of student counts. Both functions are for admins only.
- **Marking agreement** comes from the marking test (step 4g).

## The price question (8.4)
- The admin sets a price in naira and opens the question.
- Pilot students with access see "Would you pay ₦… a month for Lawdeck?" once on the home page (Yes, Maybe or No). `price_answers` takes one answer per student per price, and only for the price being asked while the question is open.
- Changing the price asks again.

## Documents (8.4, 8.5 and the decision)
These are founder documents, not part of the code: the price interview guide, the Council of Legal Education demonstration pack, and the go / revise / stop decision record.

## Tests
- Database: `tests/permissions/sql/9i_closed_pilot_test.sql` (33 checks).
- Unit: `tests/unit/pilot.test.ts`.
- Browser: the pilot page and the invite form are hidden from visitors.
