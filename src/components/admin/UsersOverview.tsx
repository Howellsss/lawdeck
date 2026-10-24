import type { UsersOverview as Overview } from "@/server/db/adminUsers";
import { SignupsChart } from "./SignupsChart";

const NAIRA_PER_DOLLAR = 1400; // The funding request's budget rate (23 October 2026), as on the Pilot page.

// A warning colours only the note, which says what needs attention.
function Stat({ label, value, note, warning }: { label: string; value: string; note?: string; warning?: boolean }) {
  return (
    <li className="rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl">{value}</p>
      {note && <p className={`text-sm ${warning ? "text-warning" : "text-muted"}`}>{note}</p>}
    </li>
  );
}

// Admin: who is joining, who pays and who is using Lawdeck. Students only; reviewers and admins are left out.
export function UsersOverview({ data }: { data: Overview }) {
  const count = (key: string) => data.counts[key] ?? 0;
  const total = count("students_total");
  const paying = count("paying");
  const pastDue = count("past_due");
  const cost = count("ai_cost_month_usd");
  const payingShare = total ? Math.round((paying / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Joined today" value={String(count("joined_today"))} note={`${count("joined_7d")} this week · ${count("joined_30d")} in 30 days`} />
        <Stat label="Students" value={total.toLocaleString("en-NG")} note={data.plans.map((p) => `${p.students} ${p.name}`).join(" · ") || "None yet"} />
        <Stat
          label="Paying"
          value={paying.toLocaleString("en-NG")}
          note={pastDue ? `${pastDue} payment${pastDue === 1 ? "" : "s"} failed` : total ? `${payingShare}% of students` : undefined}
          warning={pastDue > 0}
        />
        <Stat label="Active this week" value={count("active_7d").toLocaleString("en-NG")} note={`${count("active_30d")} in 30 days · ${count("questions_today")} questions today`} />
      </ul>
      <section aria-labelledby="signups-heading" className="flex flex-col gap-2 rounded-2xl border border-line px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="signups-heading" className="text-base font-medium">New students, last 30 days</h2>
          <p className="text-sm text-muted">
            AI cost this month ${cost.toFixed(2)} (₦{Math.round(cost * NAIRA_PER_DOLLAR).toLocaleString("en-NG")})
          </p>
        </div>
        <SignupsChart days={data.signups} />
      </section>
    </div>
  );
}
