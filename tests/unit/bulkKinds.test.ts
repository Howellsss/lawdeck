import { describe, expect, it } from "vitest";
import { bulkCost } from "@/lib/bulkKinds";

describe("bulk writing cost", () => {
  it("adds memory aids to each lesson when asked", () => expect(bulkCost("lesson", 10, true)).toEqual({ low: "3.00", high: "7.50" }));
  it("counts only lessons without them", () => expect(bulkCost("update", 10, false)).toEqual({ low: "2.00", high: "5.00" }));
  it("never adds aids to the memory aids panel itself", () => expect(bulkCost("extras", 10, true)).toEqual({ low: "1.00", high: "2.50" }));
});
