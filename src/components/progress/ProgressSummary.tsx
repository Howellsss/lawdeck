import { accuracyOf } from "@/lib/progress";
import type { Progress } from "@/server/db/progress";
import { MasteryBar, MasteryCounts } from "./MasteryBar";

// The top of My progress: every point the student is revising, split by how well it is remembered,
// and recall accuracy from their recorded answers.
export function ProgressSummary({ totals, streak }: { totals: Progress["totals"]; streak: number }) {
  const accuracy = accuracyOf(totals);
  const items = [
    {
      label: "Points mastered",
      value: String(totals.mastered),
      tone: totals.mastered ? "text-success" : "",
    },
    {
      label: "Points slipping",
      value: String(totals.slipping),
      tone: totals.slipping ? "text-warning" : "",
    },
    {
      label: "Recall accuracy",
      value: accuracy === null ? "–" : `${accuracy}%`,
      tone: "",
    },
    { label: "Days in a row", value: String(streak), tone: "" },
  ];
  return (
    <section aria-label="Summary" className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col rounded-xl border border-line bg-surface px-3 py-2.5">
            <dt className="order-2 text-xs text-muted">{item.label}</dt>
            <dd className={`order-1 font-serif text-2xl ${item.tone}`}>{item.value}</dd>
          </div>
        ))}
      </dl>
      <MasteryBar label="All points" mastered={totals.mastered} learning={totals.learning} slipping={totals.slipping} />
      <MasteryCounts mastered={totals.mastered} learning={totals.learning} slipping={totals.slipping} />
    </section>
  );
}
