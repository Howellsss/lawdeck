import { formatDateWat } from "@/lib/dates";

// New students per day as simple bars (no chart library). The numbers are also in a table for
// screen readers, and each bar names its day and count on hover.
export function SignupsChart({ days }: { days: { day: string; signups: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.signups));
  const total = days.reduce((sum, d) => sum + d.signups, 0);
  if (!days.length) return <p className="text-sm text-muted">No sign-ups to show yet.</p>;
  return (
    <div className="flex flex-col gap-1">
      <div aria-hidden="true" className="flex h-28 items-end gap-[2px]">
        {days.map((d) => (
          <div key={d.day} className="flex h-full flex-1 items-end" title={`${formatDateWat(d.day)}: ${d.signups}`}>
            <div className={`w-full rounded-t-sm ${d.signups ? "bg-ink" : "bg-line"}`} style={{ height: d.signups ? `${Math.max(6, (d.signups / max) * 100)}%` : "2px" }} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex justify-between text-xs text-muted">
        <span>{formatDateWat(days[0].day)}</span>
        <span>{total} in 30 days</span>
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>New students per day, {total} in total</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">New students</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{formatDateWat(d.day)}</th>
              <td>{d.signups}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
