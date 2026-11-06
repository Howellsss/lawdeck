import { describe, expect, it } from "vitest";
import {
  DAILY_REVISION_CAP,
  EASE,
  LONGEST_GAP_DAYS,
  easeAfter,
  gapAfterCorrect,
  nextStep,
  revisionLeftToday,
  scheduleAfter,
  weakestFirst,
  type ReviewState,
} from "@/lib/revision";
import { lagosDayStart } from "@/lib/studyDates";

const now = new Date("2026-11-05T10:00:00Z");
const days = (iso: string) => Math.round((new Date(iso).getTime() - now.getTime()) / 86_400_000);

// Answers a point correctly in revision n times, from a first reading answer.
function gapsWhenAlwaysRight(n: number, first: ReviewState = scheduleAfter(null, "correct", "reading", now)): number[] {
  let state: ReviewState = first;
  const seen: number[] = [];
  for (let i = 0; i < n; i++) {
    state = scheduleAfter(state, "correct", "revision", now);
    seen.push(state.interval_days);
  }
  return seen;
}

describe("revision timing", () => {
  it("brings a newly learned point back tomorrow, however the first answer went", () => {
    for (const outcome of ["correct", "partly", "incorrect", "skipped"] as const) {
      const state = scheduleAfter(null, outcome, "reading", now);
      expect(days(state.due_at)).toBe(1);
      expect(state.interval_days).toBe(1);
    }
  });

  it("follows about 1, 3, 7 and 14 days, then stretches the gaps for a point always remembered", () => {
    const seen = gapsWhenAlwaysRight(5);
    expect(seen).toEqual([3, 8, 16, 35, 72]);
    // Never shorter than the plain steps, and always growing.
    seen.forEach((gap, i) => expect(gap).toBeGreaterThanOrEqual([3, 7, 14, 30, 60][i]));
  });

  it("brings a point the student keeps missing back sooner and more often", () => {
    let weak: ReviewState = scheduleAfter(null, "incorrect", "reading", now);
    weak = scheduleAfter(weak, "incorrect", "revision", now);
    weak = scheduleAfter(weak, "incorrect", "revision", now);
    expect(weak.ease).toBeLessThan(EASE.start);
    expect(weak.lapses).toBe(3);
    const weakGaps = gapsWhenAlwaysRight(4, weak);
    const strongGaps = gapsWhenAlwaysRight(4);
    weakGaps.forEach((gap, i) => expect(gap).toBeLessThan(strongGaps[i]));
    // Still always moves on by at least a day while answers are right.
    weakGaps.reduce((before, gap) => (expect(gap).toBeGreaterThan(before), gap), 1);
  });

  it("repeats the gap when partly right and lowers the ease; a miss starts again tomorrow", () => {
    const at7 = { interval_days: 7, successes: 3, lapses: 0, due_at: now.toISOString(), ease: 2.5 };
    const partly = scheduleAfter(at7, "partly", "revision", now);
    expect(partly.interval_days).toBe(7);
    expect(partly.ease).toBe(2.35);
    const missed = scheduleAfter(at7, "incorrect", "revision", now);
    expect(missed.interval_days).toBe(1);
    expect(missed.lapses).toBe(1);
    expect(missed.ease).toBe(2.2);
    expect(days(missed.due_at)).toBe(1);
  });

  it("does not push a scheduled revision away, or raise the ease, when the student reads the topic again", () => {
    const due = new Date(now.getTime() + 5 * 86_400_000).toISOString();
    const state = scheduleAfter({ interval_days: 7, successes: 2, lapses: 0, due_at: due, ease: 2.5 }, "correct", "reading", now);
    expect(state.due_at).toBe(due);
    expect(state.ease).toBe(2.5);
    expect(scheduleAfter({ interval_days: 7, successes: 2, lapses: 0, due_at: due }, "incorrect", "test", now).interval_days).toBe(1);
  });

  it("keeps the ease within its limits and the longest gap capped", () => {
    expect(easeAfter(EASE.min, "incorrect", "revision")).toBe(EASE.min);
    expect(easeAfter(EASE.max, "correct", "revision")).toBe(EASE.max);
    expect(easeAfter(null, "correct", "revision")).toBe(2.6);
    expect(nextStep(120)).toBe(120);
    expect(gapAfterCorrect(179, EASE.max)).toBe(LONGEST_GAP_DAYS);
    expect(gapAfterCorrect(LONGEST_GAP_DAYS, EASE.max)).toBe(LONGEST_GAP_DAYS);
  });

  it("treats points saved before ease existed as normal ease", () => {
    const old = { interval_days: 3, successes: 2, lapses: 0, due_at: now.toISOString() };
    expect(scheduleAfter(old, "correct", "revision", now).interval_days).toBe(7);
  });
});

describe("which due points come first", () => {
  const item = (id: string, over: Partial<{ due_at: string; ease: number | null; lapses: number; last_outcome: "correct" | "partly" | "incorrect" | "skipped" | null }>) => ({
    id,
    due_at: "2026-11-01T00:00:00Z",
    ease: 2.5,
    lapses: 0,
    last_outcome: "correct" as const,
    ...over,
  });

  it("asks missed points first, then partly remembered, then the lowest ease, the most misses and the longest waiting", () => {
    const order = weakestFirst([
      item("strong-old", { due_at: "2026-10-01T00:00:00Z" }),
      item("partly", { last_outcome: "partly" }),
      item("missed", { last_outcome: "incorrect" }),
      item("low-ease", { ease: 1.8 }),
      item("many-misses", { lapses: 4 }),
      item("strong-new", {}),
      item("skipped", { last_outcome: "skipped", ease: 2.2 }),
    ]).map((i) => i.id);
    expect(order).toEqual(["skipped", "missed", "partly", "low-ease", "many-misses", "strong-old", "strong-new"]);
  });

  it("caps revision at about 20 answers a day", () => {
    expect(DAILY_REVISION_CAP).toBe(20);
    expect(revisionLeftToday(0)).toBe(20);
    expect(revisionLeftToday(15)).toBe(5);
    expect(revisionLeftToday(25)).toBe(0);
  });

  it("counts the day from Lagos midnight", () => {
    expect(lagosDayStart("2026-11-06")).toBe("2026-11-05T23:00:00.000Z");
  });
});
