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
