import { describe, expect, it } from "vitest";
import { revisionItems, sentenceAround } from "@/lib/visualRevision";
import type { LessonContent } from "@/schemas/lesson";

const text = "A wombat summons suits questions of construction. The court will not decide disputed facts on affidavits alone. See Wombat v Quokka.";
const content: LessonContent = {
  sections: [
    {
      heading: "One",
      paragraphs: [
        {
          text,
          sources: [1],
          marks: [
            { start: 2, end: 16, type: "definition" },
            { start: 116, end: 131, type: "case", authority: "wombat-v-quokka" },
          ],
        },
      ],
    },
  ],
  sources: [],
};

describe("Visual Revision Mode", () => {
  it("cuts out the sentence a phrase sits in", () => {
    const at = sentenceAround(text, 54, 59);
    expect(at.sentence).toBe("The court will not decide disputed facts on affidavits alone.");
    expect(at.sentence.slice(at.start, at.end)).toBe("court");
  });
  it("lists Lawdeck's highlights and the student's marks in reading order", () => {
    const items = revisionItems(content, [
      { id: "x", lessonId: "l", section: 0, paragraph: 0, start: 54, end: 59, quote: "court", style: "underline", note: "Made-up note" },
    ]);
    expect(items.map((i) => i.kind)).toEqual(["definition", "mine", "case"]);
    for (const i of items) expect(i.sentence.slice(i.start, i.end).length).toBeGreaterThan(0);
    expect(items[2]?.authority).toBe("wombat-v-quokka");
    expect(items[2]?.sentence.slice(items[2].start, items[2].end)).toBe("Wombat v Quokka");
    expect(items[1]?.note).toBe("Made-up note");
  });
});
