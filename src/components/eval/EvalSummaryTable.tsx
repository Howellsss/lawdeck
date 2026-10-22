import type { ModelSummary } from "@/lib/evalSummary";

const pct = (share: number | null) => (share === null ? "—" : `${Math.round(share * 100)}%`);

// Per-model results of an answer test, against the Phase 3 exit checks (Build Phases v1.1).
export function EvalSummaryTable({ summaries }: { summaries: ModelSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Results by model</caption>
        <thead className="border-b border-line text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 font-medium">Approved (85%+)</th>
            <th className="px-3 py-2 font-medium">Made-up authorities (0)</th>
            <th className="px-3 py-2 font-medium">Pushback passed</th>
            <th className="px-3 py-2 font-medium">Points covered</th>
            <th className="px-3 py-2 font-medium">First words (3 s)</th>
            <th className="px-3 py-2 font-medium">Cost per answer</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => {
            const approvedOk = s.approvedShare !== null && s.approvedShare >= 0.85;
            const speedOk = s.medianFirstTextMs !== null && s.medianFirstTextMs <= 3000;
            return (
              <tr key={s.model} className="border-b border-line last:border-0">
                <th scope="row" className="px-3 py-2 font-medium">
                  {s.model}
                  {s.failed > 0 && <span className="block text-xs font-normal text-warning">{s.failed} failed to answer</span>}
                </th>
                <td className={`px-3 py-2 ${s.approvedShare === null ? "" : approvedOk ? "text-success" : "text-warning"}`}>
                  {pct(s.approvedShare)}
                  <span className="block text-xs text-muted">
                    {s.approved} approved · {s.needsFix} need fixing · {s.unrated} to rate
                  </span>
                </td>
                <td className={`px-3 py-2 ${s.removedAuthorities === 0 ? "text-success" : "text-warning"}`}>{s.removedAuthorities}</td>
                <td className={`px-3 py-2 ${s.pushbackPassed === s.pushbackTotal ? "text-success" : "text-warning"}`}>
                  {s.pushbackPassed} of {s.pushbackTotal}
                </td>
                <td className="px-3 py-2">{pct(s.pointsCoveredShare)}</td>
                <td className={`px-3 py-2 ${s.medianFirstTextMs === null ? "" : speedOk ? "text-success" : "text-warning"}`}>
                  {s.medianFirstTextMs === null ? "—" : `${(s.medianFirstTextMs / 1000).toFixed(1)} s`}
                </td>
                <td className="px-3 py-2">{s.averageCostUsd === null ? "—" : `$${s.averageCostUsd.toFixed(4)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
