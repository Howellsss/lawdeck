# Staging and the practice restore (step 7a and 7d; founder approved 2026-11-14)

## Staging: a test copy of Lawdeck
- A second Supabase project, `lawdeck-staging`, in the same organisation, region West EU (Ireland). About
  $10 a month on top of Pro. It holds **no real student data**: only the Lawdeck structure (all migrations)
  and made-up test content and students for the load test.
- **Set it up / bring it up to date:** GitHub → Actions → **Staging set-up** → Run workflow. It applies every
  migration staging does not have yet, in order, and records each in `staging_admin.applied_migrations`.
  It refuses to run if `STAGING_DB_URL` points at the live project.
- **Secret (GitHub → Settings → Secrets and variables → Actions):** `STAGING_DB_URL`, the staging
  project's Session pooler address with its database password (Supabase → staging project → Connect).
- **Pretend AI (load test only):** with `LAWDECK_PRETEND_AI=1` **and** `APP_ENV=staging`, Lawdeck answers
  with a fixed, source-only answer after Claude's usual delay instead of calling Claude
  (`src/server/ai/pretend.ts`). It can never run on Vercel's production deployment. Set these only on
  the staging deployment, never on the live site.

## Practice restore (step 7d)
- GitHub → Actions → **Practice restore** → Run workflow; it also runs on the 1st of each month.
- It downloads the latest encrypted weekly backup, decrypts it with `BACKUP_PASSPHRASE`, restores it into a
  throwaway PostgreSQL that exists only inside the job, runs the checks in `scripts/backup/check-restore.sql`
  (tables, row-level security, accounts and profiles, courses, access rules, functions) and throws it away.
- Logs are public, so it prints only counts of problems and PASS/FAIL lines, never data.
- Locally: `scripts/backup/practice-restore.sh <decrypted dump>` with `PGHOST`/`PGPORT`/`PGUSER` of a local PostgreSQL.

## Load test (launch task 7)
- GitHub → Actions → **Load test** → Run workflow (students, default 500; arrival time, default 30 s).
- Runs only against the staging site (`https://lawdeck-git-staging-howells1.vercel.app`, the `staging` branch) and
  refuses the live site and database. Each made-up student signs in, opens the home page, asks a question (the
  pretend AI answers, no AI cost; the library search uses Voyage, a few cents) and opens the chat.
- It adds 5 made-up library items and the students, and **deletes them all at the end**, even when the test fails.
- Report (job summary): successes and timings (typical and slowest 5%) per step, PASS/FAIL against the 3-second
  budgets, and the kinds of problems. No content is printed.
- Secrets: `STAGING_SUPABASE_URL`, `STAGING_PUBLISHABLE_KEY`, `STAGING_SECRET_KEY`, `VERCEL_BYPASS_SECRET`.
- Vercel: the `staging` branch's Preview variables point at the staging project and set `APP_ENV=staging` and
  `LAWDECK_PRETEND_AI=1` (never on Production).
- Staging only: Supabase → Authentication → Rate Limits, "sign-ups and sign-ins" at 1000 per 5 minutes, because
  all made-up students sign in from GitHub's one address.

### Results 1 (2026-11-15, staging on Supabase Nano, the smallest size, below live Micro; Vercel Hobby, pretend AI)
| Students arriving within 30 s | Outcome |
|---|---|
| 50 | all succeeded; home p95 2.1 s, first words p95 3.2 s |
| 100 | all succeeded; home p95 0.6 s, first words p95 1.7 s |
| 200 | about 60% succeeded; the rest timed out or got Vercel 504s while waiting for the database |
| 500 | almost nothing succeeded; the staging database had to be restarted |
- On Nano: about 100 students starting at once. The database size is the bottleneck: pages and answers wait on it,
  and clean-up slowed from seconds to minutes. (Correction: these runs were on Nano, not on the live Micro size.)

### Results 2 (2026-11-15, staging on Supabase Medium; Vercel Hobby, pretend AI)
| Students arriving within 30 s | Outcome (slowest 5%) |
|---|---|
| 200 | all succeeded: home 0.67 s, first answer words 1.68 s, whole answer 2.32 s, chat 0.74 s (PASS; run 43690675524) |
| 500 | all 500 succeeded: home 1.29 s, first words 3.17 s (just over the 3 s budget), whole answer 4.26 s, chat 2.06 s (run 43691241909) |
- Medium holds 500 students arriving within 30 s with no failures; only the first-words time drifts just past
  3 seconds for the slowest 5%.

### Results 3 (2026-11-17, staging on Supabase Micro, the live size; Vercel Hobby, pretend AI)
| Students arriving within 30 s | Outcome (slowest 5%) |
|---|---|
| 200 | all succeeded: home 0.89 s, first words 1.99 s, whole answer 2.66 s, chat 0.98 s (PASS; run 44093755780) |
| 500 | all succeeded: home 1.00 s, first words 2.34 s, whole answer 3.10 s, chat 1.30 s (PASS; run 44094420843) |
| 1,000 | failed: 321 home pages, 62 first words, 20 whole answers, 0 chat pages; 1,679 time-outs and 909 HTTP 504s; clean-up took 4.5 minutes (run 44095164337) |
- The live size (Micro) holds 500 students arriving within 30 s; 1,000 at once overwhelms it.
- Timings vary from run to run (Micro 500 was faster than Medium 500 two days earlier), so treat each figure as
  "about".
- Staging is Vercel Hobby; the 504s at 1,000 may partly be Vercel's limits as well as the database. A 1,000 run on a
  bigger database (Medium or Large) would separate the two.
- Supabase lets about 30 password sign-ins per 5 minutes through from one address whatever the setting, so the
  test uses 25 accounts shared by the students (each with their own chat).
- Every request has a time limit (30 s pages, 130 s answers) and the visit phase stops after 12 minutes; a run
  first removes leftovers of a stopped run.

