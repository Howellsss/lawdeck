-- Security review (step 7g, rule P-05): guarantees that must stay true for every table and
-- function, including ones added later. Runs after all migrations; fails the checks if any
-- future migration forgets them.
\set ON_ERROR_STOP on
\set QUIET on

-- 1. Row-level security is switched on for every table in the app's schema (rule E-01).
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into missing
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  perform test.check(missing is null, 'every table has row-level security' || coalesce(' (missing: ' || missing || ')', ''));
end;
$$;

-- 2. Every function that runs with its owner's rights fixes its search path, so it cannot be
-- tricked into using look-alike tables or functions.
do $$
declare missing text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into missing
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) setting where setting like 'search_path=%');
  perform test.check(missing is null, 'every owner-rights function fixes its search path' || coalesce(' (missing: ' || missing || ')', ''));
end;
$$;

-- 3. Visitors who are not signed in cannot read any table directly.
do $$
declare readable text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into readable
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     and has_table_privilege('anon', c.oid, 'select');
  perform test.check(readable is null, 'visitors cannot read any table' || coalesce(' (readable: ' || readable || ')', ''));
end;
$$;

-- 4. Signed-out visitors can run only the owner-rights functions meant for them: the sign-in
-- limits (migration 29) and the takedown form (migration 28). Trigger functions cannot be run directly.
do $$
declare extra text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into extra
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('auth_wait_seconds', 'record_auth_attempt', 'submit_takedown');
  perform test.check(extra is null, 'visitors can run only the sign-in limits and the takedown form' || coalesce(' (also: ' || extra || ')', ''));
end;
$$;

-- 5. Trigger functions cannot be called by anyone; they only run when rows change (migration 33).
do $$
declare callable text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into callable
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  perform test.check(callable is null, 'trigger functions cannot be called directly' || coalesce(' (callable: ' || callable || ')', ''));
end;
$$;
