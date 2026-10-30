import Link from "next/link";
import { timeAgo } from "@/lib/adminUsers";
import { formatNaira, formatUsd } from "@/lib/adminUsage";
import { formatWat } from "@/lib/dates";
import type { UsageRankRow } from "@/server/db/adminUsage";

// Admin: everyone who used Lawdeck in the period, highest AI cost first. Names open each person's
// usage page.
export function UsageRankingTable({ rows, now, days }: { rows: UsageRankRow[]; now: Date; days: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">People by AI cost, last {days} days</caption>
        <thead className="bg-surface text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Person</th>
            <th scope="col" className="px-3 py-2 font-medium">Cost</th>
            <th scope="col" className="px-3 py-2 font-medium">Questions</th>
            <th scope="col" className="px-3 py-2 font-medium">All AI uses</th>
            <th scope="col" className="px-3 py-2 font-medium">Cost per question</th>
            <th scope="col" className="px-3 py-2 font-medium">Last active</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-muted">
                Nobody has used Lawdeck in the last {days} days.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="max-w-[260px] px-3 py-2 font-normal">
                  <Link href={`/admin/users/${row.id}`} className="block truncate font-medium">
                    {row.name ?? row.email}
                  </Link>
                  {row.name && <span className="block truncate text-muted">{row.email}</span>}
                  {row.role !== "student" && <span className="text-xs text-muted">{row.role === "admin" ? "Admin" : "Reviewer"}</span>}
                </th>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatUsd(row.costUsd)} <span className="block text-xs text-muted">{formatNaira(row.costUsd)}</span>
                </td>
                <td className="px-3 py-2">{row.questions}</td>
                <td className="px-3 py-2">{row.calls}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.questions ? formatUsd(row.costUsd / row.questions) : "–"}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {row.lastActiveAt ? (
                    <time dateTime={row.lastActiveAt} title={formatWat(row.lastActiveAt)}>
                      {timeAgo(row.lastActiveAt, now) ?? formatWat(row.lastActiveAt)}
                    </time>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
