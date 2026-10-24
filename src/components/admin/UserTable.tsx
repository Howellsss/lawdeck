import Link from "next/link";
import { signInMethodLabel, timeAgo } from "@/lib/adminUsers";
import { formatWat } from "@/lib/dates";
import type { UserRow } from "@/server/db/adminUsers";
import { PaymentBadge } from "./PaymentBadge";

function When({ value, now, empty }: { value: string | null; now: Date; empty: string }) {
  if (!value) return <span className="text-muted">{empty}</span>;
  return <time dateTime={value} title={formatWat(value)}>{timeAgo(value, now) ?? formatWat(value)}</time>;
}

// Admin: the people list, newest first. Names link to each person's details.
export function UserTable({ rows, now, filtered }: { rows: UserRow[]; now: Date; filtered: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[760px] text-left text-sm">
        <caption className="sr-only">People, newest first</caption>
        <thead className="bg-surface text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Person</th>
            <th scope="col" className="px-3 py-2 font-medium">Joined</th>
            <th scope="col" className="px-3 py-2 font-medium">Plan</th>
            <th scope="col" className="px-3 py-2 font-medium">Payment</th>
            <th scope="col" className="px-3 py-2 font-medium">Questions this month</th>
            <th scope="col" className="px-3 py-2 font-medium">Last active</th>
            <th scope="col" className="px-3 py-2 font-medium">Signed up with</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-muted">
                {filtered ? "Nobody matches. Try other words or clear the filters." : "Nobody has signed up yet."}
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
                <td className="whitespace-nowrap px-3 py-2"><When value={row.joinedAt} now={now} empty="–" /></td>
                <td className="px-3 py-2">{row.plan}</td>
                <td className="px-3 py-2">
                  <PaymentBadge status={row.payment} />
                  {row.payment === "paid" && row.paidUntil && <span className="block text-xs text-muted">until {formatWat(row.paidUntil)}</span>}
                </td>
                <td className="px-3 py-2">{row.questionsThisMonth}</td>
                <td className="whitespace-nowrap px-3 py-2"><When value={row.lastActiveAt} now={now} empty="Not yet" /></td>
                <td className="px-3 py-2">
                  {signInMethodLabel(row.signInMethod)}
                  {!row.emailConfirmed && <span className="block text-xs text-warning">Email not confirmed</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
