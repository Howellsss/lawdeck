import { signInMethodLabel, timeAgo, type PaymentStatus } from "@/lib/adminUsers";
import { formatWat } from "@/lib/dates";
import type { UserDetail } from "@/server/db/adminUsers";
import { PaymentBadge } from "./PaymentBadge";

const PAYMENT_STATUSES: PaymentStatus[] = ["paid", "past_due", "lapsed", "never"];

function when(value: string | null | undefined, now: Date, empty: string): string {
  if (!value) return empty;
  const ago = timeAgo(value, now);
  return ago ? `${formatWat(value)} (${ago.toLowerCase()})` : formatWat(value);
}

function Facts({ title, items }: { title: string; items: [string, React.ReactNode][] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl border border-line px-4 py-3 text-sm sm:grid-cols-[max-content_1fr]">
        {items.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="mb-2 sm:mb-0">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Admin: one person's account, plan and usage. Counts only, never their work itself.
export function UserDetailView({ detail, now }: { detail: UserDetail; now: Date }) {
  const payment = PAYMENT_STATUSES.find((status) => status === detail.payment_status) ?? "never";
  const role = detail.role === "admin" ? "Admin" : detail.role === "reviewer" ? "Reviewer" : "Student";
  const cost = Number(detail.ai_cost_total_usd ?? 0);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="break-words font-serif text-3xl font-normal text-greeting">{detail.full_name || detail.email}</h1>
        {detail.full_name && <p className="break-all text-muted">{detail.email}</p>}
      </div>
      <Facts
        title="Account"
        items={[
          ["Role", role],
          ["Joined", when(detail.joined_at, now, "–")],
          ["Last signed in", when(detail.last_sign_in_at, now, "Never")],
          ["Signed up with", signInMethodLabel(detail.sign_in_method ?? "email")],
          ["Email", detail.email_confirmed === "true" ? "Confirmed" : <span className="text-warning">Not confirmed</span>],
          ["Campus", detail.campus || "Not given"],
        ]}
      />
      <Facts
        title="Plan and payment"
        items={[
          ["Plan", detail.plan ?? "Free"],
          ["Payment", <PaymentBadge key="payment" status={payment} />],
          ["Paid until", detail.paid_until ? formatWat(detail.paid_until) : "–"],
          ["Pilot access", detail.pilot_access_at ? `Since ${formatWat(detail.pilot_access_at)}` : "No"],
          ["Invite code", detail.invite_code || "None"],
        ]}
      />
      <Facts
        title="Use of Lawdeck"
        items={[
          ["Questions this month", detail.questions_this_month ?? "0"],
          ["Questions in total", detail.questions_total ?? "0"],
          ["Last active", when(detail.last_active_at, now, "Not yet")],
          ["AI cost so far", `$${cost.toFixed(2)}`],
          ["Chats", detail.chats ?? "0"],
          ["Projects", detail.projects ?? "0"],
          ["Documents drafted", detail.documents ?? "0"],
          ["Practice sets", detail.practice_sets ?? "0"],
          ["Briefs", detail.briefs ?? "0"],
          ["Uploads", detail.uploads ?? "0"],
          ["Problems reported", detail.problem_reports ?? "0"],
        ]}
      />
    </>
  );
}
