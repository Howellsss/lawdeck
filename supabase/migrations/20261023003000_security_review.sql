-- Lawdeck migration 30: security review fix (Phase 7, step 7g, rule P-05).
-- Signed-out visitors had read permission on search_events (when students searched; no question
-- text). Row-level security already gave them no rows, so nothing was exposed; this removes the
-- permission itself. tests/permissions/sql/zz_guarantees_test.sql now checks every table for this.
revoke all on public.search_events from anon;
