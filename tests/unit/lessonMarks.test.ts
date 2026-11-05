import { describe, expect, it } from "vitest";
import { MAX_MARKS_PER_PARAGRAPH, markPieces, placeMarks } from "@/lib/lessonMarks";

// Made-up text: the rules for placing highlights, not legal content.
const text =
  "An originating summons suits questions of construction. The court will not decide disputed facts on affidavits. See Wombat v Quokka. The rule is in Order 3 rule 5. Where facts are disputed, the court may order pleadings.";

describe("placing a lesson's highlights", () => {
  it("finds each phrase and keeps the text unchanged", () => {
    const marks = placeMarks(text, [
      { type: "definition", phrase: "originating summons" },
      { type: "case", phrase: "Wombat v Quokka", authority: "wombat-v-quokka" },
    ], new Set(["wombat-v-quokka"]));
    expect(marks.map((m) => text.slice(m.start, m.end))).toEqual(["originating summons", "Wombat v Quokka"]);
    expect(marks[1].authority).toBe("wombat-v-quokka");
    expect(markPieces(text, marks).map((p) => p.text).join("")).toBe(text);
  });

  it("drops a phrase that is not in the paragraph, and an unknown authority key", () => {
    const marks = placeMarks(text, [
      { type: "case", phrase: "Kangaroo v Emu" },
      { type: "case", phrase: "Wombat v Quokka", authority: "made-up-key" },
    ]);
    expect(marks).toHaveLength(1);
    expect(marks[0].authority).toBeUndefined();
  });

  it("keeps at most one mark per sentence and four per paragraph, most important first", () => {
    const marks = placeMarks(text, [
      { type: "tip", phrase: "questions of construction" },
      { type: "definition", phrase: "originating summons" },
      { type: "principle", phrase: "will not decide disputed facts on affidavits" },
      { type: "case", phrase: "Wombat v Quokka" },
      { type: "statute", phrase: "Order 3 rule 5" },
      { type: "exception", phrase: "Where facts are disputed" },
    ]);
    expect(marks.length).toBeLessThanOrEqual(MAX_MARKS_PER_PARAGRAPH);
    expect(marks.map((m) => m.type)).toContain("exception");
    expect(marks.map((m) => m.type)).not.toContain("tip");
    const starts = marks.map((m) => m.start);
    expect(new Set(starts).size).toBe(starts.length);
  });

  it("never lets a mark cover most of the paragraph", () => {
    expect(placeMarks("Short rule.", [{ type: "principle", phrase: "Short rule." }])).toEqual([]);
  });
});
