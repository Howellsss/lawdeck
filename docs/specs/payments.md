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

## Part 2: Flutterwave checkout (next)
Plans page for students, Flutterwave's hosted payment page (card, transfer, USSD), a payment notice
route that re-checks every payment with Flutterwave (amount, currency, reference) before a marked admin
job records one paid month; the same payment never counts twice. Needs the founder's Flutterwave test keys.

## Part 3: reminders and wording (after part 2)
Email 3 days before a paid month ends; Terms section 3 changed from "renews until you cancel" to
"pay each month".
