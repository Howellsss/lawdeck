# Sign-in (Phase 1, step 1b)

Rules: Engineering Rules C-01 to C-04; PRD AC-01; System Design §2 (Supabase Auth).

## What students can do

| Screen | Address | What happens |
| --- | --- | --- |
| Sign in | `/sign-in` | Email first, then password (design board M1). Wrong details give one message that never says whether the account exists. |
| Create account | `/sign-up` | Email and password (at least 10 characters). Supabase emails a confirmation link; "Send the link again" is offered. |
| Confirm / reset link | `/auth/confirm` | Opened from the email. A valid link signs the student in and moves on; a bad or used link returns to sign-in with a clear message. |
| Forgot password | `/forgot-password` | Always answers "if an account uses this address, we sent a link". |
| New password | `/reset-password` | Only works after opening a valid reset link. |
| Sign out | Sidebar, bottom | Ends the session on Supabase's server, not only in the browser. |

Google sign-in is step 1e.

## How it is built

- All sign-in work happens on the server: `src/server/auth` (actions, session check, error messages). Screens in `src/components/auth` only collect input.
- Every form is checked on the server with Zod (`src/schemas/auth.ts`).
- `src/proxy.ts` only keeps the sign-in fresh. It does not decide access: pages and actions check the session themselves (`getCurrentAccount`).
- After sign-in, students only go to Lawdeck pages (`src/lib/safeNextPath.ts`), never to another site.
- Logs record the action and Supabase's error code only: never emails or passwords.
- If Supabase is not set up on a deployment, screens say "Sign-in isn't switched on yet" instead of breaking.

## Supabase settings the founder sets (in the Supabase dashboard)

1. **URL settings**: Site URL = the live address (e.g. `https://lawdeck.vercel.app`). Add `http://localhost:3000/**` and the Vercel preview addresses to the allowed redirect list.
2. **Email sign-in**: on, with "confirm email" on. Minimum password length 10.
3. **Email templates** (Confirm signup, Reset password): point the link at Lawdeck's confirm page so it works on any device:
   - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/`
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
4. **Vercel**: add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SITE_URL`.

## Known limits (tracked)

- Supabase's built-in email sender allows only a few emails an hour and is for testing. Before real students arrive, connect a proper email service (custom SMTP). Needs a decision and an account.
- Sign-in attempt limits use Supabase's built-in protection for now. The extra per-address check (rule C-04/K-02) needs the database tables from step 1c.
- Signing out after a period of inactivity (rule C-03) is a Supabase setting that may need a paid plan. To confirm when setting up.
