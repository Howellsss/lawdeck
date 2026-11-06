// One bar split into mastered, learning and slipping points (Phase 4b). Colour carries meaning only:
// green for mastered, amber for slipping, a neutral tone for learning; the counts are always written
// out beside it, so nothing depends on colour alone.
export function MasteryBar({
  mastered,
  learning,
  slipping,
  label,
}: {
  mastered: number;
  learning: number;
  slipping: number;
  label: string;
}) {
  const total = mastered + learning + slipping;
  const parts = [
    { key: "mastered", n: mastered, className: "bg-success" },
    { key: "learning", n: learning, className: "bg-muted/45" },
    { key: "slipping", n: slipping, className: "bg-warning" },
  ].filter((p) => p.n > 0);
  return (
    <div
      role="img"
      aria-label={`${label}: ${mastered} mastered, ${learning} learning, ${slipping} slipping`}
      className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-line"
    >
      {total > 0 &&
        parts.map((p) => (
          <span
            key={p.key}
            className={`${p.className} h-full first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${(p.n / total) * 100}%` }}
          />
        ))}
    </div>
  );
}

export function MasteryCounts({
  mastered,
  learning,
  slipping,
}: {
  mastered: number;
  learning: number;
  slipping: number;
}) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      <span>
        <span
          aria-hidden
          className="mr-1.5 inline-block size-2 rounded-full bg-success"
        />
        {mastered} mastered
      </span>
      <span>
        <span
          aria-hidden
          className="mr-1.5 inline-block size-2 rounded-full bg-muted/45"
        />
        {learning} learning
      </span>
      <span>
        <span
          aria-hidden
          className="mr-1.5 inline-block size-2 rounded-full bg-warning"
        />
        {slipping} slipping
      </span>
    </p>
  );
}
