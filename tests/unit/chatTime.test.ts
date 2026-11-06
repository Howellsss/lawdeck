import { describe, expect, it } from "vitest";
import { dayLabel, startsRun, watDay, watTime } from "@/lib/chatTime";

describe("chat times", () => {
  it("shows the time in West Africa Time", () => {
    expect(watTime("2026-11-06T10:42:00Z")).toBe("11:42 AM");
    expect(watDay("2026-11-05T23:30:00Z")).toBe("2026-11-06");
  });

  it("labels days as Today, Yesterday or the date", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    expect(dayLabel("2026-11-06", now)).toBe("Today");
    expect(dayLabel("2026-11-05", now)).toBe("Yesterday");
    expect(dayLabel("2026-11-03", now)).toBe("Tuesday 3 November");
    expect(dayLabel("2025-12-31", now)).toBe("Wednesday 31 December 2025");
  });

  it("keeps a person's quick messages under one name", () => {
    const a = { authorId: "a", createdAt: "2026-11-06T10:00:00Z" };
    expect(startsRun(undefined, a)).toBe(true);
    expect(startsRun(a, { authorId: "a", createdAt: "2026-11-06T10:04:00Z" })).toBe(false);
    expect(startsRun(a, { authorId: "a", createdAt: "2026-11-06T10:06:00Z" })).toBe(true);
    expect(startsRun(a, { authorId: "b", createdAt: "2026-11-06T10:01:00Z" })).toBe(true);
  });
});
