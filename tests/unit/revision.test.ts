import { describe, expect, it } from "vitest";
import { nextStep, scheduleAfter } from "@/lib/revision";

const now = new Date("2026-11-05T10:00:00Z");
const days = (iso: string) => Math.round((new Date(iso).getTime() - now.getTime()) / 86_400_000);

describe("revision timing", () => {
  it("brings a newly learned point back tomorrow, however the first answer went", () => {
    for (const outcome of ["correct", "partly", "incorrect", "skipped"] as const) {
      const state = scheduleAfter(null, outcome, "reading", now);
      expect(days(state.due_at)).toBe(1);
      expect(state.interval_days).toBe(1);
    }
  });

  it("steps through about 1, 3, 7 and 14 days while answers are right", () => {
    let state = scheduleAfter(null, "correct", "reading", now);
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      state = scheduleAfter(state, "correct", "revision", now);
      seen.push(state.interval_days);
    }
    expect(seen).toEqual([3, 7, 14, 30]);
    expect(state.successes).toBe(5);
  });

  it("repeats the step when partly right, and starts again after a miss", () => {
    const at7 = { interval_days: 7, successes: 3, lapses: 0, due_at: now.toISOString() };
    expect(scheduleAfter(at7, "partly", "revision", now).interval_days).toBe(7);
    const missed = scheduleAfter(at7, "incorrect", "revision", now);
    expect(missed.interval_days).toBe(1);
    expect(missed.lapses).toBe(1);
    expect(days(missed.due_at)).toBe(1);
  });

  it("does not push a scheduled revision away when the student reads the topic again", () => {
    const due = new Date(now.getTime() + 5 * 86_400_000).toISOString();
    const state = scheduleAfter({ interval_days: 7, successes: 2, lapses: 0, due_at: due }, "correct", "reading", now);
    expect(state.due_at).toBe(due);
    expect(scheduleAfter({ interval_days: 7, successes: 2, lapses: 0, due_at: due }, "incorrect", "test", now).interval_days).toBe(1);
  });

  it("caps the longest gap", () => {
    expect(nextStep(120)).toBe(120);
  });
});
