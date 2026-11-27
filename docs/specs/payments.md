# Payments (launch task 15)

Founder's decisions (2026-11-18): **Flutterwave**, **pay each month** (no automatic renewal; a reminder
email before the month ends), launch prices **Standard ₦3,999 · Pro ₦8,499 · Max ₦13,999**, prices
changeable later on Admin → Plans. Credits and the Admin → Plans page: the recommended defaults below.

## Part 1: plans and credits (migration 68)
- **Plans.** Free (unchanged), Standard ₦3,999 / 80 credits, Pro ₦8,499 / 180, Max ₦13,999 / 300.
  `plans.monthly_message_limit` is a plan's monthly credits; `on_sale` and `position` drive the Plans page.
- **Credits.** Each AI request records its credits when it is made (`usage_events.credits`, from
  `credit_costs`), so a later change never alters credits already used. Earlier requests count 1.

  | Job | Credits |
  |-----|---------|
  | Ordinary answer, or a voice reply that teaches | 1 |
  | Problem question (new usage kind `problem`) | 3 |
  | Marking a practice answer | 3 |
  | Drafting a document | 3 |
  | Brief | 2 |
  | Practice set, memory aid on request | 1 |
  | Reading aloud, voice small talk, routing | free |
- **Which plan.** `current_plan_id()`: the plan of an active subscription whose `period_end` is still
  ahead; otherwise Free. A paid plan set on a profile without a paid month gives nothing. Students
  cannot write subscriptions or their own plan (row-level security, column grants).
- **Admin → Plans** (`/admin/plans`): each plan's price and credits; `save_plan()` is admins only,
  keeps Free at ₦0, and records each change in the audit log. The page also lists what each job costs.
- **Wording.** "18 of 80 credits left this month"; the public-test short-period limit still counts requests.
- **Tests.** `tests/permissions/sql/9zq_paid_plans_test.sql` (21 checks); briefs, marking and drafting
  tests now expect 2, 3 and 3 credits.

## Part 2: Flutterwave checkout (migration 73, built 2026-11-27)
- **Plans page** (`/plans`; linked from Account and from "limit reached"): the paid plans on sale with a
  Pay button each. Pay starts a payment in the database (`start_payment`: Lawdeck fixes the amount and
  its reference `ldk_…`; at most 10 started an hour) and opens Flutterwave's own page (card, bank
  transfer, USSD). Only flutterwave.com checkout links are followed. No Pay buttons until
  `FLUTTERWAVE_SECRET_KEY` is set.
- **Confirming.** `/plans/done` (Flutterwave's return address) and `/api/payments/flutterwave`
  (Flutterwave's notices, which must carry `FLUTTERWAVE_WEBHOOK_HASH`) both ask Flutterwave by
  transaction id (`/v3/transactions/{id}/verify`): successful, NGN, Lawdeck's reference. Then the marked
  admin job `src/server/billing/flutterwave.ts` calls `record_payment` (service role only), which checks
  the amount again, gives one month starting when the current paid month ends, and counts each payment
  once (unique transaction id). Failed payments are marked failed; nothing else changes.
- **Data.** `payments` (owner reads own, admins read all, nobody writes from the app). Logs carry only
  Lawdeck's reference, statuses and error codes; never card, email or payment details.
- **Not built:** refunds (in Flutterwave's dashboard by hand), automatic renewal (by design).
- **Tests.** `tests/permissions/sql/9zv_flutterwave_payments_test.sql` (21 checks), `tests/unit/flutterwave.test.ts`.

## Part 3: reminders and wording (after part 2)
Email 3 days before a paid month ends; Terms section 3 changed from "renews until you cancel" to
"pay each month".
