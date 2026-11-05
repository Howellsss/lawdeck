import type { DiaryOverview } from "@/server/db/diary";

// The diary's dashboard figures (founder's brief, 19). Recall accuracy comes from answers only, never
// from time spent (brief, 11).
export function DiaryStats({ totals }: { totals: DiaryOverview["totals"] }) {
  const accuracy = totals.answered ? Math.round((totals.correct / totals.answered) * 100) : null;
  const hours = Math.floor(totals.minutes / 60);
  const time = hours ? `${hours} h ${totals.minutes % 60} min` : `${totals.minutes} min`;
  const items: { label: string; value: string; tone?: string }[] = [
    { label: "Topics studied", value: String(totals.topics) },
    { label: "Topics completed", value: String(totals.completed) },
    { label: "Time studying", value: time },
    { label: "Recall accuracy", value: accuracy === null ? "–" : `${accuracy}%`, tone: accuracy !== null && accuracy >= 70 ? "text-success" : undefined },
    { label: "Due for revision now", value: String(totals.dueNow), tone: totals.dueNow ? "text-warning" : undefined },
  ];
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col rounded-xl border border-line bg-surface px-3 py-2.5">
            <dt className="order-2 text-xs text-muted">{item.label}</dt>
            <dd className={`order-1 font-serif text-2xl ${item.tone ?? ""}`}>{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        Recall accuracy counts your recorded answers ({totals.answered}); it is not a prediction of exam results.
      </p>
    </div>
  );
}
