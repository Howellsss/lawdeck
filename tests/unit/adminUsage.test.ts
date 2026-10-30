import { describe, expect, it } from "vitest";
import { formatNaira, formatUsd, usageKindLabel } from "@/lib/adminUsage";
import { usagePeriodSchema } from "@/schemas/adminUsage";

// The admin usage pages (founder, 2026-10-30): plain names, readable money, a safe period.
describe("admin usage", () => {
  it("names each kind of AI use plainly, and shows unknown kinds as stored", () => {
    expect(usageKindLabel("explain")).toBe("Answers (questions and problem questions)");
    expect(usageKindLabel("speech")).toBe("Voice (read aloud and voice replies)");
    expect(usageKindLabel("new_kind")).toBe("new_kind");
  });

  it("shows dollars and naira readably", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.004)).toBe("<$0.01");
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatNaira(1)).toBe("₦1,400");
    expect(formatNaira(20.73)).toBe("₦29,022");
  });

  it("allows only 7, 30 or 90 days, otherwise 30", () => {
    expect(usagePeriodSchema.parse({ days: "7" }).days).toBe(7);
    expect(usagePeriodSchema.parse({ days: ["90"] }).days).toBe(90);
    expect(usagePeriodSchema.parse({ days: "365" }).days).toBe(30);
    expect(usagePeriodSchema.parse({}).days).toBe(30);
  });
});
