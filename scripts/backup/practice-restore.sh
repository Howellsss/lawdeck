#!/usr/bin/env bash
# Practice restore (step 7d): restores a decrypted Lawdeck backup into a throwaway PostgreSQL and checks it.
# Usage: PGHOST=… PGPORT=… PGUSER=postgres scripts/backup/practice-restore.sh lawdeck.dump
# Creates and drops a database called lawdeck_restore_drill. Prints no data: only counts of problems
# and PASS/FAIL lines (the repository and its logs are public).
set -euo pipefail
cd "$(dirname "$0")/../.."
DUMP="$1"
DB=lawdeck_restore_drill
case "${PGHOST:-}" in *supabase*) echo "Refusing to run against Supabase." >&2; exit 1 ;; esac
PG_RESTORE="${PG_RESTORE:-pg_restore}"

psql -q -X -d postgres -c "drop database if exists $DB" -c "create database $DB"
trap 'psql -q -X -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -f scripts/backup/prepare-restore.sql >/dev/null

set +e
"$PG_RESTORE" --no-owner --no-privileges --dbname="$DB" "$DUMP" 2> restore-errors.log
set -e
# Expected in an empty database, so not a problem: it already has a "public" schema.
grep -v 'schema "public" already exists' restore-errors.log > restore-problems.log || true
mv restore-problems.log restore-errors.log
# Only the kind of each problem is shown, never its detail (details can quote data).
problems=$(grep -c '^pg_restore: error' restore-errors.log || true)
echo "Restore finished with $problems problem(s)."
grep '^pg_restore: error' restore-errors.log | sed -E 's/^pg_restore: error: (could not execute query|COPY failed for table "[^"]+").*/\1/' \
  | sed -E 's/^pg_restore: error: .*/other/' | sort | uniq -c || true
rm -f restore-errors.log

result=$(psql -q -X -d "$DB" -f scripts/backup/check-restore.sql) || { echo "Practice restore: FAILED (the checks could not run: parts of the backup are missing)"; exit 1; }
echo "$result"
if grep -q '^FAIL' <<<"$result"; then echo "Practice restore: FAILED"; exit 1; fi
echo "Practice restore: all checks passed."
