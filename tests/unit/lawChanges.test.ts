import { describe, expect, it } from "vitest";
import { formatDateWat } from "@/lib/dates";
import { lawChangeSchema } from "@/schemas/lawChanges";
import { libraryFilterSchema } from "@/schemas/libraryReview";

const courseId = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a";

describe("recording a change in the law", () => {
  it("tidies the description and turns blanks into nothing", () => {
    expect(
      lawChangeSchema.parse({ courseId, title: "  Order  2 amended ", effectiveOn: "2024-03-01", note: " ", source: "" }),
    ).toEqual({ courseId, title: "Order 2 amended", effectiveOn: "2024-03-01", note: null, source: null });
  });

  it("needs a course, a description and a real date", () => {
    const base = { courseId, title: "Change", effectiveOn: "2024-03-01", note: "", source: "" };
    expect(lawChangeSchema.safeParse({ ...base, courseId: "civil" }).success).toBe(false);
    expect(lawChangeSchema.safeParse({ ...base, title: "  " }).success).toBe(false);
    expect(lawChangeSchema.safeParse({ ...base, effectiveOn: "1 March 2024" }).success).toBe(false);
    expect(lawChangeSchema.safeParse({ ...base, effectiveOn: "2024-02-30" }).success).toBe(false);
  });
});

describe("Library list filter", () => {
  it("accepts review statuses and 'Needs re-check', and ignores anything else", () => {
    expect(libraryFilterSchema.parse("recheck")).toBe("recheck");
    expect(libraryFilterSchema.parse("approved")).toBe("approved");
    expect(libraryFilterSchema.parse("everything")).toBeUndefined();
    expect(libraryFilterSchema.parse(undefined)).toBeUndefined();
  });
});

describe("calendar dates", () => {
  it("show the same day everywhere, with no time-zone shift", () => {
    expect(formatDateWat("2024-03-01")).toMatch(/1 Mar 2024/);
    expect(formatDateWat("not a date")).toBe("");
  });
});
