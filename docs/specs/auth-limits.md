# Sign-in, sign-up and reset limits (Phase 7, step 7c)

Engineering Rules C-04 and K-02. Founder approved 2026-10-23. Migration 29.

## Limits
- **Sign-in:** 5 wrong passwords for one email within 15 minutes pauses sign-in for that email (from any device) until 15 minutes after the 5th. The message says how many minutes to wait. Only wrong passwords count. During a pause even the right password has to wait, so someone guessing could hold an account up for at most 15 minutes at a time; they can never get in.
- **Sign-up, "forgot password", "resend email":** each limited to 5 per email and 20 per internet address an hour.
- Supabase's own built-in limits stay on underneath.

## How
- The server asks `auth_wait_seconds(kind, email_hash, ip_hash)` before each attempt and calls `record_auth_attempt(...)` for wrong passwords and for each sign-up, reset or resend request that goes ahead (`src/server/auth/limits.ts`).
- Only SHA-256 scrambles of the lowercased email and of the internet address (from `x-forwarded-for` on Vercel) are stored, and rows older than a day are removed. Nobody can read or change the table directly.
- If the limit check itself fails, the attempt goes ahead (Supabase's limits still apply) and the failure is logged with its code only.

## Known limit
These limits protect Lawdeck's own forms. Someone calling Supabase's sign-in service directly with the public key bypasses them; Supabase's built-in limits cover that path.

## Tests
`tests/permissions/sql/9k_auth_limits_test.sql` (15 checks) · `tests/unit/authLimits.test.ts`. A live check on the real project is added once migration 29 is applied. (A browser test of the pause needs a real Supabase project, so it is covered by the unit and database tests instead.)
