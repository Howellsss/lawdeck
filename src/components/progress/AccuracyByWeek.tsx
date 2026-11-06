import type { Week } from "@/lib/progress";

const weekName = (start: string) =>
  new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${start}T00:00:00Z`));

// Recall accuracy for each of the last eight weeks (Phase 4b): one ink bar per week, the share of
// answers remembered. Hover or focus a bar for its figures; the same figures are in the table below
// for screen readers. Weeks with no answers show an empty slot, not a zero.
export function AccuracyByWeek({ weeks }: { weeks: Week[] }) {
  const latest = [...weeks].reverse().find((w) => w.accuracy !== null);
  return (
    <section aria-labelledby="by-week" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="by-week" className="text-lg font-medium">
          Recall accuracy by week
        </h2>
        {latest && (
          <p className="text-sm text-muted">
            Latest: <span className="text-ink">{latest.accuracy}%</span> in the week of {weekName(latest.start)}
          </p>
        )}
      </div>
      <div aria-hidden className="relative flex h-40 items-end gap-2 border-b border-line sm:gap-3">
        {[25, 50, 75, 100].map((y) => (
          <span key={y} className="pointer-events-none absolute inset-x-0 border-t border-line/60" style={{ bottom: `${y}%` }} />
        ))}
        {weeks.map((w, i) => (
          <div key={w.start} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center outline-offset-2">
            {w.accuracy === null ? (
              <span className="mb-0.5 h-px w-full max-w-10 border-t border-dashed border-muted" />
            ) : (
              <span className="w-full max-w-10 rounded-t-[4px] bg-ink" style={{ height: `${Math.max(2, w.accuracy)}%` }} />
            )}
            <span
              className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-[11rem] ${i < 2 ? "left-0" : i >= weeks.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2"} rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink shadow-md group-hover:block group-focus:block`}
            >
              Week of {weekName(w.start)}
              <br />
              {w.accuracy === null ? "No answers" : `${w.accuracy}% · ${w.correct} of ${w.answered} remembered`}
            </span>
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-2 text-[10.5px] text-muted sm:gap-3">
        {weeks.map((w, i) => (
          <span key={w.start} className="flex-1 whitespace-nowrap text-center">
            {i % 2 === 1 || i === weeks.length - 1 ? weekName(w.start) : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Recall accuracy by week</caption>
        <thead>
          <tr>
            <th>Week of</th>
            <th>Accuracy</th>
            <th>Answers</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <td>{weekName(w.start)}</td>
              <td>{w.accuracy === null ? "No answers" : `${w.accuracy}%`}</td>
              <td>{w.answered}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
