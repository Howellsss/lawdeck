// When each recall question comes back for revision (docs/specs/remembrance.md). The steps follow
// the founder's brief (about 1, 3, 7 and 14 days, then longer). Phase 4 makes them adapt to each
// student and each point: every point has an "ease" that rises when it is remembered and falls when
// it is missed. Easy points stretch beyond the steps; points a student keeps missing come back
// sooner and more often. A miss always starts again tomorrow. No library: plain rules, tested.
export const REVISION_STEPS_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;
export const LONGEST_GAP_DAYS = 180;
// The most revision answers asked for in one Lagos day, so a student coming back after time away
// never faces a huge pile (founder approved, Phase 4).
export const DAILY_REVISION_CAP = 20;

export const EASE = { start: 2.5, min: 1.3, max: 3, correct: 0.1, partly: -0.15, missed: -0.3 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RecallOutcome = "correct" | "partly" | "incorrect" | "skipped";
export type ReviewState = { interval_days: number; successes: number; lapses: number; due_at: string; ease?: number | null };
export type Scheduled = Required<Omit<ReviewState, "ease">> & { ease: number; last_outcome: RecallOutcome; last_reviewed_at: string };

export function nextStep(intervalDays: number): number {
  return REVISION_STEPS_DAYS.find((step) => step > intervalDays) ?? REVISION_STEPS_DAYS[REVISION_STEPS_DAYS.length - 1];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampEase = (n: number) => round2(Math.min(EASE.max, Math.max(EASE.min, n)));
const isMiss = (outcome: RecallOutcome) => outcome === "incorrect" || outcome === "skipped";

// How the point's ease changes after an answer. In revision every answer counts; while learning
// (reading or the topic test) only a miss lowers it, so rereading a topic cannot inflate it.
export function easeAfter(ease: number | null | undefined, outcome: RecallOutcome, context: "reading" | "test" | "revision"): number {
  const now = ease ?? EASE.start;
  if (isMiss(outcome)) return clampEase(now + EASE.missed);
  if (context !== "revision") return clampEase(now);
  return clampEase(now + (outcome === "correct" ? EASE.correct : EASE.partly));
}

// The gap after a correct revision answer: the next step, stretched or shortened by the ease
// (at the starting ease it is the plain step), and always at least a day longer than before.
export function gapAfterCorrect(intervalDays: number, ease: number): number {
  const scaled = Math.round(nextStep(intervalDays) * (ease / EASE.start));
  return Math.min(LONGEST_GAP_DAYS, Math.max(intervalDays + 1, scaled));
}

// The schedule after an answer. While learning, a first answer always comes back tomorrow; in
// revision, the gap depends on how it went and on the point's ease.
export function scheduleAfter(
  previous: ReviewState | null,
  outcome: RecallOutcome,
  context: "reading" | "test" | "revision",
  now: Date = new Date(),
): Scheduled {
  const at = (days: number) => new Date(now.getTime() + days * DAY_MS).toISOString();
  const missed = isMiss(outcome);
  const successes = (previous?.successes ?? 0) + (outcome === "correct" ? 1 : 0);
  const lapses = (previous?.lapses ?? 0) + (missed ? 1 : 0);
  const ease = easeAfter(previous?.ease, outcome, context);
  const stamp = { ease, last_outcome: outcome, last_reviewed_at: now.toISOString() };

  if (!previous) return { interval_days: 1, successes, lapses, due_at: at(1), ...stamp };
  if (context !== "revision") {
    // Learning again: a miss brings it back tomorrow; otherwise the existing schedule stands.
    return missed
      ? { interval_days: 1, successes, lapses, due_at: at(1), ...stamp }
      : { interval_days: previous.interval_days, successes, lapses, due_at: previous.due_at, ...stamp };
  }
  const interval = outcome === "correct" ? gapAfterCorrect(previous.interval_days, ease) : outcome === "partly" ? previous.interval_days : 1;
  return { interval_days: interval, successes, lapses, due_at: at(interval), ...stamp };
}

// The order due points are asked in: the weakest first (missed last time, then the lowest ease,
// then the most misses), and among equals the one waiting longest.
export type DueItem = { due_at: string; ease: number | null; lapses: number; last_outcome: RecallOutcome | null };
export function weakestFirst<T extends DueItem>(items: T[]): T[] {
  const missedLast = (i: DueItem) => (i.last_outcome !== null && isMiss(i.last_outcome) ? 0 : i.last_outcome === "partly" ? 1 : 2);
  return [...items].sort(
    (a, b) =>
      missedLast(a) - missedLast(b) ||
      (a.ease ?? EASE.start) - (b.ease ?? EASE.start) ||
      b.lapses - a.lapses ||
      a.due_at.localeCompare(b.due_at),
  );
}

// How many revision questions are left for today, given how many were answered today.
export function revisionLeftToday(answeredToday: number): number {
  return Math.max(0, DAILY_REVISION_CAP - answeredToday);
}
