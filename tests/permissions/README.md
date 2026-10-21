# Permission tests

Proof that one student can never touch another student's data (rules E-06, O-02).

## 1. Database rules on a local PostgreSQL (no Supabase needed)

`npm run test:db` loads the migrations into a throwaway local database (with a small
stand-in for Supabase's sign-in tables) and runs `sql/rls_test.sql`. Needs PostgreSQL 15+
running locally; set `PGHOST`, `PGPORT` and `PGUSER` if it is not the default.

## 2. The real Supabase project

`npm run test:permissions` signs in as two test students and tries to reach each other's
work through Supabase, exactly as the app does. It needs these settings (never in code,
never in chat):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD`

The two test accounts are made in Supabase (Authentication → Users → Add user, confirmed
automatically). They are only for tests and hold no real data. Missing settings make the
run fail, because a skipped permission test is not a pass.
