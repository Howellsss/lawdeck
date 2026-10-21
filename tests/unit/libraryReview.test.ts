import { describe, expect, it } from "vitest";
import { approvalBlockers, todayInLagos } from "@/lib/reviewRules";
import { passageCorrectionSchema, reviewDecisionSchema, reviewPageSchema, reviewStatusFilterSchema } from "@/schemas/libraryReview";

const ready = {
  readingStatus: "done" as const,
  passages: 165,
  indexedPassages: 165,
  indexModel: "voyage-4",
  indexedAt: "2026-10-21T12:00:00Z",
};
const id = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a";

describe("what blocks an approval", () => {
  it("nothing, when the item is read and fully indexed", () => {
    expect(approvalBlockers(ready, "voyage-4")).toEqual([]);
  });

  it("an unread or empty item", () => {
    expect(approvalBlockers({ ...ready, readingStatus: "waiting" }, "voyage-4")[0]).toMatch(/not been read/);
    expect(approvalBlockers({ ...ready, passages: 0 }, "voyage-4")[0]).toMatch(/not been read/);
  });

  it("an item not fully indexed, or indexed with an older model", () => {
    expect(approvalBlockers({ ...ready, indexedPassages: 164 }, "voyage-4")[0]).toMatch(/indexed/);
    expect(approvalBlockers({ ...ready, indexedAt: null }, "voyage-4")[0]).toMatch(/indexed/);
    expect(approvalBlockers(ready, "voyage-law-2")[0]).toMatch(/indexed/);
  });
});

describe("a reviewer's decision", () => {
  it("approving needs a 'current as of' date", () => {
    const missing = reviewDecisionSchema.safeParse({ id, status: "approved", lawCurrentAsOf: "", note: "" });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(["lawCurrentAsOf"]);
    expect(reviewDecisionSchema.safeParse({ id, status: "approved", lawCurrentAsOf: "2026-09-30", note: "" }).success).toBe(true);
  });

  it("other decisions do not need a date", () => {
    expect(reviewDecisionSchema.parse({ id, status: "withdrawn", lawCurrentAsOf: "", note: " " })).toEqual({
      id,
      status: "withdrawn",
      lawCurrentAsOf: null,
      note: null,
    });
  });

  it("refuses unknown decisions, bad dates and long notes", () => {
    expect(reviewDecisionSchema.safeParse({ id, status: "published", lawCurrentAsOf: "", note: "" }).success).toBe(false);
    expect(reviewDecisionSchema.safeParse({ id, status: "approved", lawCurrentAsOf: "30/09/2026", note: "" }).success).toBe(false);
    expect(reviewDecisionSchema.safeParse({ id, status: "rejected", lawCurrentAsOf: "", note: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("a passage correction", () => {
  it("tidies the heading and keeps the wording", () => {
    expect(passageCorrectionSchema.parse({ passageId: id, heading: "  Order  2 ", text: " Text " })).toEqual({
      passageId: id,
      heading: "Order 2",
      text: "Text",
    });
  });

  it("refuses an empty or very long passage", () => {
    expect(passageCorrectionSchema.safeParse({ passageId: id, heading: "", text: "  " }).success).toBe(false);
    expect(passageCorrectionSchema.safeParse({ passageId: id, heading: "", text: "x".repeat(20001) }).success).toBe(false);
  });
});

describe("page and filter in the address", () => {
  it("falls back safely for odd values", () => {
    expect(reviewPageSchema.parse("3")).toBe(3);
    expect(reviewPageSchema.parse("-1")).toBe(1);
    expect(reviewPageSchema.parse("abc")).toBe(1);
    expect(reviewStatusFilterSchema.parse("approved")).toBe("approved");
    expect(reviewStatusFilterSchema.parse("everything")).toBeUndefined();
  });

  it("knows today's date in Lagos", () => {
    expect(todayInLagos(new Date("2026-10-21T23:30:00Z"))).toBe("2026-10-22");
  });
});
