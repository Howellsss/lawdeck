import type { QuizState } from "@/lib/quiz";

const PLACES = [
  { at: 1, label: "1st", height: "h-28", order: "order-2" },
  { at: 0, label: "2nd", height: "h-20", order: "order-1" },
  { at: 2, label: "3rd", height: "h-14", order: "order-3" },
];

// The top three on a podium at the end of a quiz: 2nd, 1st, 3rd from left to right.
export function QuizPodium({ rows }: { rows: QuizState["leaderboard"] }) {
  const top = rows.slice(0, 3);
  if (top.length === 0) return null;
  return (
    <ol aria-label="Podium" className="flex items-end justify-center gap-2 pt-2">
      {PLACES.map(({ label, height, order }, i) => {
        const row = top[i];
        if (!row) return null;
        return (
          <li key={label} className={`flex w-28 flex-col items-center gap-1 ${order}`}>
            <span className="max-w-full truncate text-center text-[14px] font-semibold">
              {row.name}
              {row.me && <span className="font-normal text-muted"> (you)</span>}
            </span>
            <span className="text-[13px] tabular-nums text-muted">{row.points} pts</span>
            <span className={`flex w-full items-start justify-center rounded-t-lg border border-line bg-surface pt-2 font-serif text-2xl ${height}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
