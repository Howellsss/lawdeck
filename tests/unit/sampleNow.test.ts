import { describe, expect, it } from "vitest";
import { sampleNow } from "@/app/test-pages/sampleNow";

const watDay = (iso: string) => new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 10);

describe("the test pages' sample time", () => {
  it("keeps recent sample messages on today's date in WAT just after midnight", () => {
    const now = Date.parse("2026-11-12T23:46:00Z"); // 00:46 on 13 November in Nigeria
    const base = sampleNow(now);
    expect(watDay(new Date(base - 60 * 60_000).toISOString())).toBe("2026-11-13");
    expect(watDay(new Date(base - 26 * 3_600_000).toISOString())).toBe("2026-11-12");
  });

  it("is the real time later in the day", () => {
    const now = Date.parse("2026-11-12T14:00:00Z");
    expect(sampleNow(now)).toBe(now);
  });
});
