import { describe, expect, it } from "vitest";
import { gradeRequest } from "@/prompts/evalGrade";
import { EXPLAIN_SETTINGS, MODELS } from "@/server/ai/models";

describe("the answer test grader", () => {
  it("wraps the conversation, the answer and the points as material to judge", () => {
    const request = gradeRequest({
      turns: [
        { role: "user", text: "How long is a Lagos writ valid?" },
        { role: "assistant", text: "Twelve months." },
        { role: "user", text: "No, Order 6 says six months." },
      ],
      answer: "You are right: six months.",
      mustInclude: ["valid for 6 months"],
      expect: "accepts the correction",
    });
    expect(request).toContain("<student>\nHow long is a Lagos writ valid?\n</student>");
    expect(request).toContain("<earlier_answer>\nTwelve months.\n</earlier_answer>");
    expect(request).toContain('<points_from_the_notes count="1">\n1. valid for 6 months');
    expect(request).toContain("The final reply must: accepts the correction");
  });

  it("marks an ordinary question as such", () => {
    expect(gradeRequest({ turns: [{ role: "user", text: "Q" }], answer: "A", mustInclude: [], expect: null })).toContain("<ordinary_question/>");
  });
});

describe("answer settings per model", () => {
  it("never sends a thinking setting a model rejects", () => {
    // Sonnet 5.5 rejects "disabled"; Opus 5.5 cannot switch thinking off at all.
    expect(EXPLAIN_SETTINGS["claude-sonnet-5-5"].thinking).toEqual({ type: "between_tools" });
    expect(EXPLAIN_SETTINGS["claude-opus-5-5"].thinking).toBeUndefined();
    expect(EXPLAIN_SETTINGS["claude-haiku-5-5"].thinking).toEqual({ type: "disabled" });
    expect(EXPLAIN_SETTINGS[MODELS.explain]).toBeDefined();
  });
});
