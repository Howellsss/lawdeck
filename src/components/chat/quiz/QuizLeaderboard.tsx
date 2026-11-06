import { place, type QuizState } from "@/lib/quiz";

// Names and points, best first. The caller's own row is marked "you".
export function QuizLeaderboard({ rows, total, final = false }: { rows: QuizState["leaderboard"]; total: number; final?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={final ? "Final leaderboard" : "Leaderboard"} className="flex flex-col gap-2">
      <h3 className="text-[15px] font-medium">{final ? "Final leaderboard" : "Leaderboard"}</h3>
      <ol className="flex flex-col divide-y divide-line rounded-xl border border-line">
        {rows.map((r, i) => (
          <li key={`${r.name}-${i}`} className={`flex items-center gap-3 px-3 py-2 text-[15px] ${r.me ? "bg-pill" : ""}`}>
            <span className="w-10 shrink-0 font-semibold tabular-nums">{place(i + 1)}</span>
            <span className="min-w-0 flex-1 truncate">
              {r.name}
              {r.me && <span className="text-muted"> (you)</span>}
            </span>
            <span className="shrink-0 text-[13px] text-muted">
              {r.correct}/{total} right
            </span>
            <span className="w-16 shrink-0 text-right font-semibold tabular-nums">{r.points}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
