const LETTERS = ["A", "B", "C", "D", "E", "F"];

// After a question closes: how many players chose each answer, the right one marked.
export function QuizChart({ counts, correct }: { counts: number[]; correct: number | null }) {
  const most = Math.max(1, ...counts);
  return (
    <figure aria-label="How everyone answered" className="flex flex-col gap-1.5">
      <figcaption className="text-[14px] font-medium">How everyone answered</figcaption>
      <ul className="flex flex-col gap-1">
        {counts.map((n, i) => (
          <li key={i} className="flex items-center gap-2 text-[14px]">
            <span className="w-5 shrink-0 font-semibold">{LETTERS[i]}</span>
            <span className="h-5 flex-1 overflow-hidden rounded bg-pill" aria-hidden>
              <span className={`block h-full rounded ${i === correct ? "bg-success" : "bg-muted"}`} style={{ width: `${(n / most) * 100}%` }} />
            </span>
            <span className="w-24 shrink-0 tabular-nums text-muted">
              {n} {n === 1 ? "player" : "players"}
              {i === correct && <span className="sr-only"> (right answer)</span>}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
