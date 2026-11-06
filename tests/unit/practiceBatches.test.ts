import { describe, expect, it } from "vitest";
import { mergeReplies, planBatches } from "@/server/practice/batches";

// Faster practice sets (founder, 2026-10-31): small batches written at once, each from its own passages.
describe("practice batches", () => {
  it("keeps small sets, or sets with one passage, as one batch", () => {
    expect(planBatches([1, 2, 3], 2)).toEqual([{ hits: [1, 2, 3], count: 2 }]);
    expect(planBatches([1], 10)).toEqual([{ hits: [1], count: 10 }]);
  });

  it("shares questions evenly and deals the passages out in turn", () => {
    expect(planBatches([1, 2, 3, 4, 5, 6, 7, 8], 7)).toEqual([
      { hits: [1, 5], count: 2 },
      { hits: [2, 6], count: 2 },
      { hits: [3, 7], count: 2 },
      { hits: [4, 8], count: 1 },
    ]);
    expect(planBatches([1, 2, 3, 4, 5, 6, 7, 8], 7, 3).map((b) => b.count)).toEqual([3, 2, 2]);
    expect(planBatches([1, 2], 10).map((b) => b.count)).toEqual([5, 5]);
  });

  it("never asks one reply for more than 20 questions, even from one passage", () => {
    const plan = planBatches([1], 30);
    expect(plan.map((b) => b.count)).toEqual([15, 15]);
    expect(plan.every((b) => b.hits.length === 1)).toBe(true);
    const many = planBatches([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 30);
    expect(many).toHaveLength(10);
    expect(many.reduce((n, b) => n + b.count, 0)).toBe(30);
    expect(Math.max(...many.map((b) => b.count))).toBeLessThanOrEqual(20);
  });

  it("joins the replies in order and says when any batch had too little", () => {
    const item = { question: "Q?", choices: ["a", "b"], correctChoice: 0, answer: "Because [S1].", sources: [1] };
    expect(mergeReplies([{ notEnough: false, items: [item] }, { notEnough: true, items: [] }])).toEqual({ notEnough: true, items: [item] });
  });
});
