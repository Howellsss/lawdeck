// "Get ready": the big 3, 2, 1 before each question opens.
export function QuizReady({ readyIn, current, total }: { readyIn: number; current: number; total: number }) {
  return (
    <section aria-label="Get ready" className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-[15px] text-muted">
        Question {current + 1} of {total}
      </p>
      <p className="font-serif text-3xl">Get ready…</p>
      <p aria-live="assertive" className="font-serif text-7xl tabular-nums">
        {Math.max(1, Math.ceil(readyIn))}
      </p>
    </section>
  );
}
