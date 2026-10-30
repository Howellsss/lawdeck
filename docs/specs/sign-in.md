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

| Continue with Google | `/sign-in`, `/sign-up` | Shown only when `GOOGLE_SIGN_IN_ENABLED=true`. Google returns the student to `/auth/callback`, which signs them in; a cancelled or failed attempt returns to sign-in with a clear message. |

## How it is built

- All sign-in work happens on the server: `src/server/auth` (actions, session check, error messages). Screens in `src/components/auth` only collect input.
- Every form is checked on the server with Zod (`src/schemas/auth.ts`).
- `src/proxy.ts` only keeps the sign-in fresh. It does not decide access: pages and actions check the session themselves (`getCurrentAccount`).
- After sign-in, students only go to Lawdeck pages (`src/lib/safeNextPath.ts`), never to another site.
- Logs record the action and Supabase's error code only: never emails or passwords.
- If Supabase is not set up on a deployment, screens say "Sign-in isn't switched on yet" instead of breaking.

## Supabase settings the founder sets (in the Supabase dashboard)

1. **URL settings**: Site URL = the live address, `https://mylawdeck.com` (also allow `https://www.mylawdeck.com/**` and `https://lawdeck.vercel.app/**`). Add `http://localhost:3000/**` and the Vercel preview addresses to the allowed redirect list.
2. **Email sign-in**: on, with "confirm email" on. Minimum password length 10.
3. **Email templates** (Confirm signup, Reset password). Supabase only allows editing these once a custom email service (SMTP) is connected, so this waits for that. When possible, point the link at Lawdeck's confirm page so it works on any device:
   - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/`
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
4. **Vercel**: add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SITE_URL`.

## Google sign-in set-up (founder, once)

1. Google Cloud: create an OAuth client of type "Web application". Authorised redirect URI:
   `https://vvidwaslcbmzbrcqvdyz.supabase.co/auth/v1/callback`. Keep the client secret private.
2. Supabase → Authentication → Sign In / Providers → Google: switch on, paste the client ID and secret there (never in chat or code).
3. Vercel: add `GOOGLE_SIGN_IN_ENABLED=true` (Config) and redeploy. The button appears.

## Known limits (tracked)

- Until the templates can be edited, Supabase's standard email links only finish signing in when opened in the same browser that asked for them. Otherwise Lawdeck explains what to do (`?error=browser`): an email confirmation has usually worked, so the student signs in; a reset link must be reopened in the right browser or requested again.

- Supabase's built-in email sender allows only a few emails an hour and is for testing. Before real students arrive, connect a proper email service (custom SMTP). Needs a decision and an account.
- Sign-in attempt limits use Supabase's built-in protection for now. The extra per-address check (rule C-04/K-02) needs the database tables from step 1c.
- Signing out after a period of inactivity (rule C-03) is a Supabase setting that may need a paid plan. To confirm when setting up.
