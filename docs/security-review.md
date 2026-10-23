# Security review (Phase 7, step 7g; rule P-05)

Date: 2026-10-23. Scope: permissions, secrets and uploads, plus browser security headers.
Plan approved by the founder ("APPROVE", 2026-10-23). Migration 30 approved by the founder the same day.

## Findings and fixes

| # | Finding | Risk | Fix | Status |
|---|---------|------|-----|--------|
| 1 | The site sent no browser security headers. Another site could show Lawdeck inside a hidden frame to trick people into clicking ("clickjacking"). | Medium | Every page and file now sends: no framing by other sites (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), no file-type guessing (`nosniff`), only Lawdeck's address in links to other sites (`Referrer-Policy`), camera, microphone, location and payments switched off (`Permissions-Policy`), and secure connections only for two years (`Strict-Transport-Security`). `src/lib/securityHeaders.ts`; browser tests in `tests/e2e/security.spec.ts`. | Fixed |
| 2 | There was no content security policy (a list of which scripts, styles and connections pages may use). | Medium | Sent in "report only" mode: browsers report what it would block to `/api/csp-report` (logged as the rule and the blocked site only), and nothing is blocked yet. The public pages break none of it (browser test). | Report only; see "Left for later" |
| 3 | Signed-out visitors had read permission on `search_events` (when students searched; no question text). Row-level security still gave them no rows, so nothing was exposed. | Low | Migration 30 removes the permission. | Fixed once migration 30 is applied |
| 4 | Marking a problem report or takedown request done relied on the database alone to check that the person is a reviewer, and accepted any of the three statuses for either list. | Low (the database already refused) | Both actions now check the reviewer role on the server and accept only their own statuses. | Fixed |
| 5 | Zod (the input-checking library) tests whether the browser allows `eval` the first time it builds a check. The content security policy reports this, and would block it once enforced. | Low | Zod is set up once in `src/lib/zod.ts` with `jitless` (it never uses `eval`); ESLint requires every file to import it from there. | Fixed |
| 6 | `.env.example` listed a hosted PDF converter that is no longer used (Save as PDF prints the pages, founder 2026-10-23), and left out the test-only settings. | Very low | Removed the converter names; listed `LAWDECK_TEST_PAGES`, `EVAL_MODELS` and `EVAL_CASES` as tests only, never set on Vercel. | Fixed |

## Checked and found sound

- **Row-level security**: switched on for every table. A new database check (`tests/permissions/sql/zz_guarantees_test.sql`) fails the build if any future table lacks it.
- **Functions with extra rights** (security definer): every one fixes its search path, so it cannot be tricked into using look-alike tables. Checked automatically for future functions too.
- **What visitors can reach in the database**: no table is readable without signing in, and they can run only the three functions meant for them: the sign-in limits (step 7c) and the takedown form. Both are checked automatically.
- **Server actions and routes**: every one checks sign-in or role on the server and checks its input. The exceptions are the actions that are open to everyone by design, each with its reason: signing in, the takedown form, email links and the health check, which needs a secret code. A new unit test (`tests/unit/serverGuards.test.ts`) lists them all, and fails on any new action that does neither. It was shown to catch a deliberately unguarded action.
- **Redirects after sign-in**: only Lawdeck pages are accepted (`safeNextPath`, with its own tests).
- **Service-role key**: used only in `src/server/db/admin.ts` and marked admin jobs, and stored only in Vercel and GitHub's encrypted settings. It never reaches the browser.
- **Browser settings (`NEXT_PUBLIC_*`)**: none of them is secret. They are the Supabase address and publishable key (protected by row-level security), plus the Google client id, app number and picker key.
- **Secrets in the code**: none, in the current code or anywhere in its history, by a search for Anthropic, Voyage, Supabase, Google and private-key patterns. GitHub's push protection (on since 2026-10-20) blocks new ones. GitHub's on-demand secret scan tool needs GitHub Advanced Security, which this repository does not have.
- **Uploads**:
  - Only PDF, Word, PNG and JPEG files, 25 MB or less, are accepted. The real type is read from the file's first bytes on the server, and anything else is deleted.
  - The file store is private, and each student can read, add or delete only inside their own folder.
  - Uploaded and library text reaches Claude only inside `<passages>`. The text cannot close that wrapper, and every prompt says passages are material, never instructions (rule G-07).
  - Other text the student types is cleaned the same way before it is wrapped: answers sent for marking, drafting facts and instructions, brief names, practice topics and drafting requests.
  - A student's question is their own request to Claude, so it is not wrapped. Whatever it says, the citation check still removes any authority that is not in the library.
- **Logs**: they record ids, error codes and counts, never document text, uploads or passwords. The new policy-report address logs only the rule and the blocked site's name.

## Left for later

1. **Switch the content security policy on.** Once the live site has been used for a few days with Google sign-in and the Drive import, read the `csp report` lines in Vercel's logs. If they show nothing Lawdeck needs, change `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `src/lib/securityHeaders.ts`.
2. **A stricter policy with a fresh code per page** (no `'unsafe-inline'` scripts). Next.js can only do this when every page is built at request time, which would slow the home page against its 3-second budget. Revisit after the pilot.
3. **The Google picker key** (founder, Google Cloud console): confirm it is restricted to Lawdeck's web address and to the Google Picker API only.
4. **HSTS preload**: not requested. Lawdeck is on a `vercel.app` address for now; reconsider when it moves to its own domain.
