-- Lawdeck migration 73: paying for a plan with Flutterwave (launch task 15, part 2; founder
-- 2026-11-18: Flutterwave, pay each month; prices from Admin → Plans).
-- 1. payments: one row per payment a student starts. The amount is fixed when the student presses
--    Pay, so a later price change never alters a payment already started. Students read their
--    own; admins read all; nobody writes from the app.
-- 2. start_payment(plan): the signed-in student starts paying for a plan on sale. Lawdeck chooses
--    the reference and the amount; at most 10 started in an hour.
-- 3. record_payment(...): only the marked admin job calls it, after asking Flutterwave itself
--    that the payment succeeded. It gives one paid month of the plan, starting when the student's
--    current paid month ends (so paying early never loses days). The same payment counts once.
-- 4. fail_payment(ref): the marked admin job records a payment Flutterwave says failed.
-- Needs migrations 1–72.

-- 1. Payments ----------------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  amount_ngn integer not null check (amount_ngn between 1 and 1000000),
  tx_ref text not null unique check (tx_ref ~ '^ldk_[0-9a-f]{32}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider_transaction_id text unique check (provider_transaction_id ~ '^[0-9]{1,20}$'),
  subscription_id uuid references public.subscriptions (id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payments enable row level security;
create index payments_owner_created_idx on public.payments (owner_id, created_at desc);
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy "Students read their own payments" on public.payments
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Admins read all payments" on public.payments
  for select to authenticated using ((select public.is_admin()));

-- A Flutterwave payment gives at most one paid month.
create unique index subscriptions_flutterwave_ref_idx on public.subscriptions (provider_ref)
  where provider = 'flutterwave';

-- 2. Starting a payment ---------------------------------------------------------------------------
create function public.start_payment(plan uuid)
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
       where x.owner_id = me and x.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many payments started. Try again in an hour.' using errcode = '54000';
  end if;
  insert into public.payments (owner_id, plan_id, amount_ngn, tx_ref)
  values (me, chosen.id, chosen.price_ngn, ref);
  return query select ref, chosen.price_ngn, chosen.name;
end;
$$;
revoke execute on function public.start_payment(uuid) from public, anon;
grant execute on function public.start_payment(uuid) to authenticated;

-- 3. Recording a payment Flutterwave confirmed (marked admin job only) ------------------------
create function public.record_payment(ref text, provider_id text, paid_amount numeric, paid_currency text)
returns table (plan_name text, period_end timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  plan_label text;
  starts timestamptz;
  sub uuid;
begin
  select * into pay from public.payments p where p.tx_ref = ref for update;
  if not found then
    raise exception 'Unknown payment.' using errcode = '23503';
  end if;
  select p.name into plan_label from public.plans p where p.id = pay.plan_id;
  -- Already recorded: the same answer again, nothing added.
  if pay.status = 'paid' then
    if pay.provider_transaction_id is distinct from provider_id then
      raise exception 'This payment was already recorded with another transaction.' using errcode = '23505';
    end if;
    return query select plan_label, s.period_end from public.subscriptions s where s.id = pay.subscription_id;
    return;
  end if;
  if paid_currency is distinct from 'NGN' or paid_amount is null or paid_amount < pay.amount_ngn then
    raise exception 'The amount paid does not match.' using errcode = '22023';
  end if;
  starts := greatest(now(), coalesce((
    select max(s.period_end) from public.subscriptions s
     where s.owner_id = pay.owner_id and s.status = 'active' and s.period_end > now()), now()));
  insert into public.subscriptions (owner_id, plan_id, status, amount_ngn, period_end, provider, provider_ref)
  values (pay.owner_id, pay.plan_id, 'active', pay.amount_ngn, starts + interval '1 month', 'flutterwave', provider_id)
  returning id into sub;
  update public.payments
     set status = 'paid', provider_transaction_id = provider_id, subscription_id = sub, paid_at = now()
   where id = pay.id;
  return query select plan_label, starts + interval '1 month';
end;
$$;
revoke execute on function public.record_payment(text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.record_payment(text, text, numeric, text) to service_role;

-- 4. A payment that failed (marked admin job only) ---------------------------------------------
create function public.fail_payment(ref text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments set status = 'failed' where tx_ref = ref and status = 'pending';
$$;
revoke execute on function public.fail_payment(text) from public, anon, authenticated;
grant execute on function public.fail_payment(text) to service_role;
