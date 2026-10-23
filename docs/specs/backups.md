# Weekly database backup (free plan safety net)

Founder's request, 2026-10-23. Supabase's free plan has no automatic backups. Until Lawdeck moves to Supabase Pro (daily backups, kept 7 days), `.github/workflows/weekly-backup.yml` makes one copy a week.

- **When:** Mondays at 01:41 UTC (02:41 in Lagos). It can also be run by hand: GitHub → Actions → Weekly backup → Run workflow.
- **What:** the database tables, sign-in accounts and the list of stored files (the `public`, `auth` and `storage` schemas). The files themselves (uploads, library originals) are not included. For the test that is acceptable; on Pro, Supabase backs them up.
- **Kept:** 30 days, so the last four weeks, as a run "artifact" on GitHub.
- **Safety:**
  - The repository is public, so every copy is encrypted (AES-256) with `BACKUP_PASSPHRASE` before it is stored.
  - Without the passphrase the file is unreadable.
  - The job never prints data, only the file size.
- **Secret settings (GitHub → Settings → Secrets and variables → Actions):**
  - `SUPABASE_DB_URL`: the database connection string, including the database password (a secret).
  - `BACKUP_PASSPHRASE`: a long phrase only the founder knows, also kept in a password manager. **If it is lost, the backups cannot be opened.**

## Setting it up (founder, about 10 minutes, once)
1. **The connection string:**
   1. In Supabase, open the project and press **Connect** at the top.
   2. Choose **Session pooler**, which works from GitHub, and copy the URI.
   3. Replace `[YOUR-PASSWORD]` with the database password. If you don't know it: Project Settings → Database → Reset database password.
2. **The passphrase:** make up a long phrase (at least 5 random words) and save it in your password manager.
3. **The two GitHub secrets:** GitHub → the lawdeck repository → Settings → Secrets and variables → Actions → New repository secret.
   - `SUPABASE_DB_URL` = the connection string.
   - `BACKUP_PASSPHRASE` = the phrase.
4. **Try it:** Actions → Weekly backup → Run workflow. After about 2 minutes, the run shows "Backup made: … encrypted", and a file to download under Artifacts.

## Restoring (with Claude Code's help)
1. **Download:** open the run in GitHub → Actions → Weekly backup and download `lawdeck-database-backup` (a zip).
2. **Decrypt:** `gpg --decrypt --output lawdeck.dump lawdeck-YYYY-MM-DD.dump.gpg`, and enter the passphrase.
3. **Restore:** `pg_restore --clean --if-exists --no-owner --dbname "<connection string>" lawdeck.dump`. Restore into a new Supabase project first and check it, before touching the live one.

Rehearsed on 2026-10-23 with the test database: dump, encrypt, decrypt and restore all worked, and the encrypted file held no readable data.

## Keys
`SUPABASE_DB_URL` contains the database password. If it is exposed:
1. reset the password in Supabase (Project Settings → Database);
2. update the GitHub secret.

It is listed in the breach response plan's key table.
