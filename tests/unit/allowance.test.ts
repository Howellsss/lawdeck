import { describe, expect, it } from "vitest";
import { allowanceNote, limitReachedMessage, questionsLeft, resetDay } from "@/lib/allowance";

describe("monthly question allowance", () => {
  it("counts the questions left, never below zero", () => {
    expect(questionsLeft({ used: 12, limit: 30, unlimited: false })).toBe(18);
    expect(questionsLeft({ used: 31, limit: 30, unlimited: false })).toBe(0);
    expect(questionsLeft({ used: 99, limit: 0, unlimited: true })).toBeNull();
  });

  it("writes the note under the question box", () => {
    expect(allowanceNote({ used: 12, limit: 30, unlimited: false })).toBe("18 of 30 questions left this month");
    expect(allowanceNote({ used: 0, limit: 1, unlimited: false })).toBe("1 of 1 question left this month");
    expect(allowanceNote({ used: 5, limit: 0, unlimited: true })).toBeNull();
  });

  it("says when questions reset, in Lagos time", () => {
    // 31 October 23:30 UTC is already 1 November in Lagos (UTC+1).
    expect(resetDay(new Date("2026-10-31T23:30:00Z"))).toBe("1 December");
    expect(resetDay(new Date("2026-10-22T10:00:00Z"))).toBe("1 November");
    expect(resetDay(new Date("2026-12-15T10:00:00Z"))).toBe("1 January");
    expect(limitReachedMessage({ used: 30, limit: 30, unlimited: false }, new Date("2026-10-22T10:00:00Z"))).toBe(
      "You’ve used all 30 questions for this month. You can ask again from 1 November.",
    );
  });
});

describe("short-term limit for a public test (migration 35)", () => {
  const now = new Date("2026-10-24T13:00:00Z"); // 2 pm in Lagos
  const full = { used: 7, limit: 25, unlimited: false, window: { used: 5, limit: 5, resetsAt: "2026-10-24T15:40:00Z" } };

  it("counts what is left in the window or the month, whichever is less", () => {
    expect(questionsLeft({ ...full, window: { used: 2, limit: 5, resetsAt: null } })).toBe(3);
    expect(questionsLeft({ used: 24, limit: 25, unlimited: false, window: { used: 0, limit: 5, resetsAt: null } })).toBe(1);
    expect(questionsLeft(full)).toBe(0);
  });

  it("writes both counts under the question box", () => {
    expect(allowanceNote({ ...full, window: { used: 2, limit: 5, resetsAt: null } })).toBe("3 of 5 left for now · 18 of 25 this month");
  });

  it("says when the student can ask again, in Lagos time", () => {
    expect(limitReachedMessage(full, now)).toBe("You’ve used your 5 questions for now. You can ask again at 4:40 pm.");
    expect(limitReachedMessage({ ...full, window: { ...full.window, resetsAt: "2026-10-24T23:30:00Z" } }, now)).toBe(
      "You’ve used your 5 questions for now. You can ask again tomorrow at 12:30 am.",
    );
  });

  it("puts the monthly limit first once it is used up", () => {
    expect(limitReachedMessage({ ...full, used: 25 }, now)).toMatch(/all 25 questions for this month/);
  });
});
