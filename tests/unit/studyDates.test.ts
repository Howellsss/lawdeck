import { describe, expect, it } from "vitest";
import { lagosDate, whenStudied } from "@/lib/studyDates";

describe("lagosDate", () => {
  it("uses Lagos time, an hour ahead of UTC", () => {
    expect(lagosDate(new Date("2026-11-05T22:59:00Z"))).toBe("2026-11-05");
    expect(lagosDate(new Date("2026-11-05T23:00:00Z"))).toBe("2026-11-06");
  });
});

describe("whenStudied", () => {
  const now = new Date("2026-11-05T09:00:00Z");
  it("says Yesterday for the day before", () => expect(whenStudied("2026-11-04", now)).toBe("Yesterday"));
  it("counts days within a week", () => expect(whenStudied("2026-11-02", now)).toBe("3 days ago"));
  it("gives the date when older", () => expect(whenStudied("2026-10-20", now)).toBe("On 20 Oct"));
  it("treats late-evening Lagos time as the next day", () =>
    expect(whenStudied("2026-11-05", new Date("2026-11-05T23:30:00Z"))).toBe("Yesterday"));
});
