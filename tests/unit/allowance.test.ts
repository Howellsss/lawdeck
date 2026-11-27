import { describe, expect, it } from "vitest";
import { allowanceNote, CLOSED_PILOT_MESSAGE, limitReachedMessage, questionsLeft, resetDay, TRIAL_ENDED_MESSAGE } from "@/lib/allowance";

describe("monthly question allowance", () => {
  it("counts the questions left, never below zero", () => {
    expect(questionsLeft({ used: 12, limit: 30, unlimited: false })).toBe(18);
    expect(questionsLeft({ used: 31, limit: 30, unlimited: false })).toBe(0);
    expect(questionsLeft({ used: 99, limit: 0, unlimited: true })).toBeNull();
  });

  it("writes the note under the question box", () => {
    expect(allowanceNote({ used: 12, limit: 30, unlimited: false })).toBe("18 of 30 credits left this month");
    expect(allowanceNote({ used: 0, limit: 1, unlimited: false })).toBe("1 of 1 credit left this month");
    expect(allowanceNote({ used: 5, limit: 0, unlimited: true })).toBeNull();
  });

  it("says when questions reset, in Lagos time", () => {
    // 31 October 23:30 UTC is already 1 November in Lagos (UTC+1).
    expect(resetDay(new Date("2026-10-31T23:30:00Z"))).toBe("1 December");
    expect(resetDay(new Date("2026-10-22T10:00:00Z"))).toBe("1 November");
    expect(resetDay(new Date("2026-12-15T10:00:00Z"))).toBe("1 January");
    expect(limitReachedMessage({ used: 30, limit: 30, unlimited: false }, new Date("2026-10-22T10:00:00Z"))).toBe(
      "You’ve used all 30 credits for this month. You can ask again from 1 November.",
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
    expect(limitReachedMessage(full, now)).toBe("You’ve used your 5 credits for now. You can ask again at 4:40 pm.");
    expect(limitReachedMessage({ ...full, window: { ...full.window, resetsAt: "2026-10-24T23:30:00Z" } }, now)).toBe(
      "You’ve used your 5 credits for now. You can ask again tomorrow at 12:30 am.",
    );
  });

  it("puts the monthly limit first once it is used up", () => {
    expect(limitReachedMessage({ ...full, used: 25 }, now)).toMatch(/all 25 credits for this month/);
  });
});

describe("3-hour, weekly and paid-month limits, and the 7-day trial (migration 74)", () => {
  const now = new Date("2026-11-27T13:00:00Z"); // Friday 2 pm in Lagos
  const standard = {
    used: 18,
    limit: 70,
    unlimited: false,
    window: { used: 2, limit: 8, resetsAt: null },
    week: { used: 6, limit: 25, resetsAt: null },
    periodEndsAt: "2026-12-27T10:00:00Z",
    trial: false,
  };

  it("counts what is left in the smallest of the three limits", () => {
    expect(questionsLeft(standard)).toBe(6);
    expect(questionsLeft({ ...standard, week: { used: 24, limit: 25, resetsAt: null } })).toBe(1);
    expect(questionsLeft({ ...standard, used: 70 })).toBe(0);
  });

  it("writes all three under the question box", () => {
    expect(allowanceNote(standard)).toBe("6 of 8 left for now · 19 of 25 this week · 52 of 70 this month");
    expect(allowanceNote({ used: 4, limit: 30, unlimited: false, window: { used: 4, limit: 7, resetsAt: null }, trial: true })).toBe(
      "3 of 7 left for now · 26 of 30 in your trial",
    );
  });

  it("says when the week refills, with the day when it is further than tomorrow", () => {
    const full = { ...standard, week: { used: 25, limit: 25, resetsAt: "2026-11-30T08:00:00Z" } };
    expect(limitReachedMessage(full, now)).toBe("You’ve used your 25 credits for this week. They refill on Mon 30 Nov at 9:00 am.");
  });

  it("sends students to Plans when a paid month or the trial is used up", () => {
    expect(limitReachedMessage({ ...standard, used: 70 }, now)).toBe(
      "You’ve used all 70 credits for this paid month (until 27 Dec). Pay for another month on Plans to keep going.",
    );
    expect(limitReachedMessage({ used: 30, limit: 30, unlimited: false, trial: true }, now)).toMatch(/free trial\. Choose a plan/);
    expect(limitReachedMessage({ used: 3, limit: 0, unlimited: false, trial: true }, now)).toBe(TRIAL_ENDED_MESSAGE);
    expect(limitReachedMessage({ used: 0, limit: 0, unlimited: false }, now)).toBe(CLOSED_PILOT_MESSAGE);
  });
});
