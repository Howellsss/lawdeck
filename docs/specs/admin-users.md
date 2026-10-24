# Admin Users dashboard

Requested by the founder, 2026-10-24: "track who just joined, their plan, paid or not, and everything else that should ordinarily be in the dashboard. Clear and straight to the point."
Built overnight while the founder slept; the founder reviewed it, applied migration 34 and approved it on 2026-10-24.

## Where
- **Admin → Users** (`/admin/users`), in the sidebar for admins only.
- One person's page: `/admin/users/<id>`.
- Everyone else, including reviewers, gets "page not found". The database checks the admin role again (migration 34).

## What it shows
**At the top (students only; reviewers and admins are left out):**
- joined today, this week and in 30 days;
- the number of students, and how many are on each plan;
- the number paying, and failed payments (amber);
- active this week (asked at least one question), active in 30 days, and questions today;
- new students per day for the last 30 days (simple bars, no chart library);
- the AI cost this month, in dollars and naira.

**The people list (everyone, newest first, 50 a page):**
- name and email;
- when they joined;
- plan;
- payment (Paid with the end date, Payment failed, Lapsed or Not paid);
- questions this month and when they were last active;
- signed up with Google or email, and "Email not confirmed" when that applies.
- Reviewers and admins are labelled.
- Search by email or name, and filter by plan or payment.
- The filters are in the page address, so a filtered list can be bookmarked.

**One person:**
- **Account:** role, campus, joined, last signed in, sign-in method, email confirmed.
- **Plan and payment:** plan, payment, paid until, pilot access and invite code.
- **Usage counts:** questions this month and in total, last active, AI cost so far, and how many chats, projects, documents, practice sets, briefs, uploads and problem reports they have.
- **Counts only:** the admin never sees the person's chats, documents or uploads themselves.

## Payments
- No payment provider is connected yet (Build Phases: "Choose payment provider", founder).
- Migration 34 adds the `subscriptions` table from System Design §3:
  - its fields are plan, status (`active`, `past_due`, `cancelled`, `expired`), amount in naira, period end and the provider's reference;
  - it never holds card details;
  - students read only their own rows and admins read all;
  - **nobody can write it from the app**, not even admins. The payment provider's confirmation will be recorded by a marked admin job when payments are built.
- Until then everyone shows as **Not paid**, and the page says so.
- A person's payment status comes from their latest subscription:
  - **Paid:** active and not past its end;
  - **Payment failed:** past due;
  - **Lapsed:** had one, now ended;
  - **Not paid:** never had one.

## Privacy
- This page shows admins people's **emails and names**. The Pilot page shows counts only.
- Emails live in Supabase's sign-in table, which the app cannot read. Owner-rights database functions read it only after checking the caller is an admin.
- No service-role key is used.
- Nothing here is sent to the AI.
- Logs hold error codes only, never emails.
- There is no export of emails (a list of emails leaving Lawdeck needs the founder's and the data protection contact's decision).

## Database (migration 34)
- `subscriptions` table with row-level security.
- `admin_overview()`: headline counts.
- `admin_signups_by_day(days)`: 1–365 days.
- `admin_users(search, plan_name, payment, page_size, page_offset)`: 1–100 a page; % and _ in the search are matched literally.
- `admin_user_detail(person)`.
- `payment_status(person)` and `iso_time(value)` are helpers no app user can call.

## Tests
- Database: `tests/permissions/sql/9m_admin_users_test.sql` (29 checks). Students, reviewers and visitors cannot list people, read counts or ask anyone's payment status. A student sees only their own subscription and cannot mark themselves as paid. The filters, search, paging and payment status work.
- Unit: `tests/unit/adminUsers.test.ts`.
- Browser: the Users pages are hidden from visitors.

## Not done yet (needs the founder)
- Changing a person's plan or giving pilot access from this page. This writes data, so it needs a plan approval.
- Payments: choose the provider, then build checkout and the job that writes `subscriptions`.
