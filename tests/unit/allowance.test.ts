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
