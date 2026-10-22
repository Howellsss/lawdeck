import { describe, expect, it } from "vitest";
import { blindOrder, median, parseGrade, summariseByModel, type EvalAnswerRow } from "@/lib/evalSummary";

const row = (over: Partial<EvalAnswerRow>): EvalAnswerRow => ({
  caseId: "Q01",
  caseKind: "question",
  model: "m1",
  rating: null,
  removedAuthorities: 0,
  firstTextMs: 1000,
  costUsd: 0.01,
  error: null,
  grade: { pointsCovered: 2, pointsTotal: 3, pushbackOk: null, note: "" },
  ...over,
});

describe("answer test summary", () => {
  it("counts ratings, made-up authorities, pushback and speed per model", () => {
    const [m1] = summariseByModel(
      [
        row({ rating: "approved", firstTextMs: 900 }),
        row({ caseId: "Q02", rating: "needs_fix", removedAuthorities: 1, firstTextMs: 2100 }),
        row({ caseId: "Q03", firstTextMs: 1500 }),
        row({ caseId: "P01", caseKind: "pushback", rating: "approved", grade: { pointsCovered: 1, pointsTotal: 1, pushbackOk: true, note: "" } }),
        row({ caseId: "Q04", error: "busy", firstTextMs: null }),
        row({ model: "m2", rating: "approved" }),
      ],
      ["m1"],
    );
    expect(m1).toMatchObject({
      answers: 5,
      failed: 1,
      approved: 2,
      needsFix: 1,
      unrated: 1,
      removedAuthorities: 1,
      pushbackPassed: 1,
      pushbackTotal: 1,
      medianFirstTextMs: 1250,
    });
    expect(m1.approvedShare).toBeCloseTo(2 / 3);
    expect(m1.pointsCoveredShare).toBeCloseTo(7 / 10);
  });

  it("works out the median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(3);
  });

  it("hides which model wrote which answer, in a fixed order per case", () => {
    const answers = [{ model: "haiku" }, { model: "sonnet" }, { model: "opus" }];
    const first = blindOrder("Q01", answers).map((a) => a.model);
    expect(blindOrder("Q01", [...answers].reverse()).map((a) => a.model)).toEqual(first);
    expect(new Set(first)).toEqual(new Set(["haiku", "sonnet", "opus"]));
    const orders = new Set(["Q01", "Q02", "Q03", "Q04", "Q05", "Q06"].map((id) => blindOrder(id, answers)[0].model));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("reads the grader's result safely", () => {
    expect(parseGrade({ pointsCovered: 2, pointsTotal: 3, pushbackOk: true, note: "ok" })).toEqual({ pointsCovered: 2, pointsTotal: 3, pushbackOk: true, note: "ok" });
    expect(parseGrade({ pointsCovered: "2" })).toBeNull();
    expect(parseGrade(null)).toBeNull();
  });
});
