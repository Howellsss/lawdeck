-- Shared helpers for the database permission tests.
\set ON_ERROR_STOP on

-- Helpers -------------------------------------------------------------------
create schema test;
grant usage on schema test to anon, authenticated;

create function test.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, false);
  execute 'set role authenticated';
end $$;

create function test.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', false);
  execute 'set role anon';
end $$;

create function test.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok - %', what;
end $$;

-- Runs a statement that must be refused (permission or rule error).
create function test.refused(stmt text, what text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when insufficient_privilege or check_violation or foreign_key_violation then
    raise notice 'ok - % (refused)', what;
    return;
  end;
  raise exception 'FAILED: % (was allowed)', what;
end $$;

grant execute on all functions in schema test to anon, authenticated;

