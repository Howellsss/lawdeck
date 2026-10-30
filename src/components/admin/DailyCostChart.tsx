import { formatUsd } from "@/lib/adminUsage";
import { formatDateWat } from "@/lib/dates";

// One person's AI cost per day as simple bars (no chart library), like the sign-ups chart. The
// numbers are also in a table for screen readers, and each bar names its day and cost on hover.
export function DailyCostChart({ days }: { days: { day: string; calls: number; costUsd: number }[] }) {
  const max = Math.max(0.0001, ...days.map((d) => d.costUsd));
  const total = days.reduce((sum, d) => sum + d.costUsd, 0);
  if (!days.length) return <p className="text-sm text-muted">No use to show yet.</p>;
  return (
    <div className="flex flex-col gap-1">
      <div aria-hidden="true" className="flex h-28 items-end gap-[2px]">
        {days.map((d) => (
          <div key={d.day} className="flex h-full flex-1 items-end" title={`${formatDateWat(d.day)}: ${formatUsd(d.costUsd)}, ${d.calls} uses`}>
            <div
              className={`w-full rounded-t-sm ${d.costUsd ? "bg-ink" : "bg-line"}`}
              style={{ height: d.costUsd ? `${Math.max(6, (d.costUsd / max) * 100)}%` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex justify-between text-xs text-muted">
        <span>{formatDateWat(days[0].day)}</span>
        <span>{formatUsd(total)} in 30 days</span>
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>AI cost per day, {formatUsd(total)} in total</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Uses</th>
            <th scope="col">Cost</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{formatDateWat(d.day)}</th>
              <td>{d.calls}</td>
              <td>{formatUsd(d.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
