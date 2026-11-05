// When each recall question comes back for revision (docs/specs/remembrance.md). The steps follow
// the founder's brief (about 1, 3, 7 and 14 days, then longer) and adjust to the student's
// results: a correct answer moves to the next step, a partly right one repeats the step, and a
// wrong or skipped one starts again tomorrow. No library: plain rules, tested.
export const REVISION_STEPS_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RecallOutcome = "correct" | "partly" | "incorrect" | "skipped";
export type ReviewState = { interval_days: number; successes: number; lapses: number; due_at: string };

export function nextStep(intervalDays: number): number {
  return REVISION_STEPS_DAYS.find((step) => step > intervalDays) ?? REVISION_STEPS_DAYS[REVISION_STEPS_DAYS.length - 1];
}

// The schedule after an answer. While learning (reading or the topic test), a first answer always
// comes back tomorrow; in revision, the step depends on how it went.
export function scheduleAfter(
  previous: ReviewState | null,
  outcome: RecallOutcome,
  context: "reading" | "test" | "revision",
  now: Date = new Date(),
): ReviewState & { last_outcome: RecallOutcome; last_reviewed_at: string } {
  const at = (days: number) => new Date(now.getTime() + days * DAY_MS).toISOString();
  const missed = outcome === "incorrect" || outcome === "skipped";
  const successes = (previous?.successes ?? 0) + (outcome === "correct" ? 1 : 0);
  const lapses = (previous?.lapses ?? 0) + (missed ? 1 : 0);
  const stamp = { last_outcome: outcome, last_reviewed_at: now.toISOString() };

  if (!previous) return { interval_days: 1, successes, lapses, due_at: at(1), ...stamp };
  if (context !== "revision") {
    // Learning again: a miss brings it back tomorrow; otherwise the existing schedule stands.
    return missed
      ? { interval_days: 1, successes, lapses, due_at: at(1), ...stamp }
      : { interval_days: previous.interval_days, successes, lapses, due_at: previous.due_at, ...stamp };
  }
  const interval = outcome === "correct" ? nextStep(previous.interval_days) : outcome === "partly" ? previous.interval_days : 1;
  return { interval_days: interval, successes, lapses, due_at: at(interval), ...stamp };
}
