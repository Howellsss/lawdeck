#!/usr/bin/env bash
# Runs the migrations and the permission tests on a throwaway local PostgreSQL 15+.
# Usage: PGHOST=… PGPORT=… PGUSER=postgres scripts/test-db-local.sh
# It creates and then drops a database called lawdeck_rls_test. Never point it at Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=lawdeck_rls_test
case "${PGHOST:-}" in *supabase*) echo "Refusing to run against Supabase." >&2; exit 1 ;; esac

psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB"' EXIT

# Results are hidden; the tests report through NOTICE lines and stop at the first failure.
run() { psql -q -X -v ON_ERROR_STOP=1 -o /dev/null -d "$DB" -f "$1" 2>&1 | sed -e "s/^psql:[^ ]* NOTICE:  //" -e "/does not exist, skipping/d"; return "${PIPESTATUS[0]}"; }
run tests/permissions/sql/supabase_stub.sql
for file in supabase/migrations/*.sql; do run "$file"; done
run tests/permissions/sql/helpers.sql
for file in tests/permissions/sql/*_test.sql; do run "$file"; done
