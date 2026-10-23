-- Lawdeck migration 31: security review follow-up (Phase 7, step 7g, rule P-05).
-- Trigger functions (the ones that run automatically when rows change) were marked as callable
-- by anyone. Postgres refuses to run them outside a trigger, so nothing was exposed; this removes
-- the permission itself. Triggers keep working. tests/permissions/sql/zz_guarantees_test.sql now
-- checks every trigger function, including ones added later.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;
