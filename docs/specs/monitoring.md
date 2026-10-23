# Monitoring and alerts (Phase 7, step 7e; rules I-04, P-03)

Plan approved by the founder, 2026-10-23: Sentry's free plan for error alerts (no Sentry library), and an hourly unusual-access check that alerts through GitHub (no new service).

## Error alerts (I-04)
- **Server errors:** every error in a page, API route, server action or the proxy reaches `onRequestError` in `src/instrumentation.ts`, which sends it to Sentry.
- **Browser errors:** a browser error caught by the workspace error page is sent to `/api/error-report`, and the server passes it on. That way the Sentry address never reaches the browser. Errors from the server carry a "digest" and are already reported, so they are not sent twice.
- **What is sent** (`src/server/monitoring/sentry.ts`, `scrub.ts`):
  - the error type;
  - the message, with emails, ids, keys, phone numbers, long numbers and quoted text blanked, and cut to 200 characters;
  - the page, with ids and share codes removed;
  - where the error happened, the environment and the release.
  
  Never questions, documents, uploads or names (rule I-03).
- **Limits:** at most 20 reports a minute per server instance, with a 3-second time limit. A failed report never affects the page.
- **Switch:** nothing is sent until `SENTRY_DSN` is set in Vercel. Sentry emails the founder when a new kind of error first appears.

## Unusual access (P-03)
- **Download log (migration 31):** `download_events` records each Word download and export (who and when, never the file), and keeps 30 days. It is written only through `record_download()`, and nobody can read it directly.
- **Hourly counts:** `unusual_activity()` gives the last hour's counts, for the admin job only (service key). The counts are:
  - failed sign-ins;
  - accounts paused after 5 wrong passwords;
  - sign-ups;
  - the most downloads by one account;
  - the most questions by one account.
- **The hourly job:** `.github/workflows/unusual-access.yml` runs at 17 minutes past each hour. It compares the counts with the limits in `src/lib/unusualActivity.ts`, which are starting guesses to tune after the pilot's first weeks:

  | Count (last hour) | Limit |
  |-------------------|-------|
  | Failed sign-ins in total | 50 |
  | Accounts paused after 5 wrong passwords | 5 |
  | Sign-ups | 100 |
  | Downloads by a single account | 30 |
  | Questions by a single account | 60 |
  
  Over a limit, the job fails and GitHub emails the founder. The job's page shows counts only, never who. Next step: follow `docs/breach-response-plan.md`, step 2.

## Tests
- Database: `tests/permissions/sql/9h_unusual_access_test.sql`. Students, admins in the app and visitors can neither read the download log nor run the summary. The summary holds five counts and nothing else.
- Unit: `tests/unit/monitoring.test.ts` covers scrubbing, the Sentry format and the limits. The new route is listed in `tests/unit/serverGuards.test.ts`.
- Browser: `tests/e2e/security.spec.ts` checks that the error-report address accepts only small, valid reports.
