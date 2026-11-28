-- Lawdeck migration 75: failed payment attempts no longer use up the hourly limit (founder,
-- 2026-11-28: "Too many payments started" after Flutterwave refused Lawdeck's key 10 times).
-- 1. start_payment counts only payments still waiting (pending) towards the 10 an hour. A
--    payment Flutterwave refused to open is marked failed by the marked admin job, so it no
--    longer counts.
-- 2. The payments started before this, while Flutterwave refused Lawdeck's key, never reached
--    Flutterwave (no payment page was opened), so they are marked failed now.
-- Needs migrations 1–74.

create or replace function public.start_payment(plan uuid)
returns table (tx_ref text, amount_ngn integer, plan_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  chosen public.plans;
  ref text := 'ldk_' || replace(gen_random_uuid()::text, '-', '');
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select * into chosen from public.plans p where p.id = plan;
  if not found or not chosen.on_sale or coalesce(chosen.price_ngn, 0) <= 0 then
    raise exception 'That plan cannot be bought.' using errcode = '22023';
  end if;
  if (select count(*) from public.payments x
       where x.owner_id = me and x.status = 'pending' and x.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many payments started. Try again in an hour.' using errcode = '54000';
  end if;
  insert into public.payments (owner_id, plan_id, amount_ngn, tx_ref)
  values (me, chosen.id, chosen.price_ngn, ref);
  return query select ref, chosen.price_ngn, chosen.name;
end;
$$;
revoke execute on function public.start_payment(uuid) from public, anon;
grant execute on function public.start_payment(uuid) to authenticated;

update public.payments set status = 'failed' where status = 'pending' and provider_transaction_id is null;
