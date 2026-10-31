import Link from "next/link";
import { formatDateWat } from "@/lib/dates";
import type { PilotDashboard } from "@/server/db/pilot";

const NAIRA_PER_DOLLAR = 1400; // The funding request's budget rate (23 October 2026).

function perStudent(counts: Record<string, number>, key: string): string {
  const students = counts.active_students ?? 0;
  if (!students) return "–";
  const value = (counts[key] ?? 0) / students;
  return key === "ai_cost_usd" ? `$${value.toFixed(2)}` : value.toFixed(1);
}

// Admin: the pilot's weekly measures and the exit checklist figures (Phase 8). Counts only.
export function PilotMeasures({ data }: { data: PilotDashboard }) {
  const { summary, weeks } = data;
  const cohort = summary.week4_cohort ?? 0;
  const retained = summary.week4_retained ?? 0;
  const answers = (summary.price_yes ?? 0) + (summary.price_maybe ?? 0) + (summary.price_no ?? 0);
  const yesShare = answers ? Math.round(((summary.price_yes ?? 0) / answers) * 100) : null;
  const retention = cohort ? Math.round((retained / cohort) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 sm:grid-cols-3">
        <li className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-sm text-muted">Still active in week 4 (target 40%)</p>
          <p className={`text-2xl ${retention === null ? "" : retention >= 40 ? "text-success" : "text-warning"}`}>{retention === null ? "Not yet" : `${retention}%`}</p>
          <p className="text-sm text-muted">{cohort ? `${retained} of ${cohort} students` : "Shown once students have used Lawdeck for 4 weeks"}</p>
        </li>
        <li className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-sm text-muted">Would pay {summary.price_ngn ? `₦${summary.price_ngn.toLocaleString("en-NG")}` : "the tested price"} (target 15%)</p>
          <p className={`text-2xl ${yesShare === null ? "" : yesShare >= 15 ? "text-success" : "text-warning"}`}>{yesShare === null ? "No answers" : `${yesShare}%`}</p>
          <p className="text-sm text-muted">{answers ? `${summary.price_yes ?? 0} yes, ${summary.price_maybe ?? 0} maybe, ${summary.price_no ?? 0} no` : "Open the price question on the Pilot page"}</p>
        </li>
        <li className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-sm text-muted">Open problem reports</p>
          <p className={`text-2xl ${data.openReports ? "text-warning" : ""}`}>{data.openReports}</p>
          <p className="text-sm">
            <Link href="/admin/reports">Review reports</Link> · <Link href="/admin/eval">Answer tests</Link>
          </p>
        </li>
      </ul>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Weekly pilot measures</caption>
          <thead className="bg-surface text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Week of</th>
              <th scope="col" className="px-3 py-2 font-medium">Active students</th>
              <th scope="col" className="px-3 py-2 font-medium">Questions per student</th>
              <th scope="col" className="px-3 py-2 font-medium">AI cost</th>
              <th scope="col" className="px-3 py-2 font-medium">Cost per student</th>
              <th scope="col" className="px-3 py-2 font-medium">Documents drafted</th>
              <th scope="col" className="px-3 py-2 font-medium">New pilot students</th>
              <th scope="col" className="px-3 py-2 font-medium">Problem reports</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {weeks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-muted">No activity in the last 6 weeks yet.</td>
              </tr>
            ) : (
              weeks.map(({ weekStart, counts }) => (
                <tr key={weekStart}>
                  <th scope="row" className="px-3 py-2 font-normal">{formatDateWat(weekStart)}</th>
                  <td className="px-3 py-2">{counts.active_students ?? 0}</td>
                  <td className="px-3 py-2">{perStudent(counts, "questions")}</td>
                  <td className="px-3 py-2">
                    ${(counts.ai_cost_usd ?? 0).toFixed(2)}
                    <span className="block text-muted">₦{Math.round((counts.ai_cost_usd ?? 0) * NAIRA_PER_DOLLAR).toLocaleString("en-NG")}</span>
                  </td>
                  <td className="px-3 py-2">{perStudent(counts, "ai_cost_usd")}</td>
                  <td className="px-3 py-2">{counts.documents_drafted ?? 0}</td>
                  <td className="px-3 py-2">{counts.invites_redeemed ?? 0}</td>
                  <td className="px-3 py-2">{counts.problem_reports ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        AI cost includes everyone, including reviewers and tests; student counts leave reviewers and admins out. Naira at ₦{NAIRA_PER_DOLLAR.toLocaleString("en-NG")} per dollar. Marking agreement comes from the marking test (step 4g) on the Answer tests page.
      </p>
    </div>
  );
}
