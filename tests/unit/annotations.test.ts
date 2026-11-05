import { describe, expect, it } from "vitest";
import { paragraphGroups, placeAnnotation, type Annotation } from "@/lib/annotations";
import type { LessonContent } from "@/schemas/lesson";

const text = "A wombat summons suits questions of construction. The court will not decide disputed facts.";
const content: LessonContent = {
  sections: [
    { heading: "One", paragraphs: [{ text, sources: [1], marks: [] }] },
    { heading: "Two", paragraphs: [{ text: "Made-up text about appeals within 14 days.", sources: [1], marks: [] }] },
  ],
  sources: [],
};
const ann = (over: Partial<Annotation> = {}): Annotation => ({
  id: "a1",
  lessonId: "l1",
  section: 0,
  paragraph: 0,
  start: 2,
  end: 16,
  quote: "wombat summons",
  style: "highlight",
  note: null,
  ...over,
});

describe("finding a student's mark again", () => {
  it("stays where it was when the words are still there", () => expect(placeAnnotation(ann(), content)).toMatchObject({ start: 2, end: 16 }));
  it("follows the words when they moved within the paragraph", () =>
    expect(placeAnnotation(ann({ start: 30, end: 44 }), content)).toMatchObject({ section: 0, start: 2, end: 16 }));
  it("follows the words to another section", () =>
    expect(placeAnnotation(ann({ quote: "within 14 days" }), content)).toMatchObject({ section: 1, paragraph: 0 }));
  it("is kept aside when the words are gone", () => expect(placeAnnotation(ann({ quote: "words no longer here" }), content)).toBeNull());
});

describe("cutting a paragraph into marks", () => {
  it("keeps every character exactly once, with its start", () => {
    const placed = placeAnnotation(ann(), content)!;
    const groups = paragraphGroups(text, [{ start: 52, end: 61, type: "principle" }], [placed]);
    const parts = groups.flatMap((g) => g.parts);
    expect(parts.map((p) => p.text).join("")).toBe(text);
    for (const p of parts) expect(text.slice(p.start, p.start + p.text.length)).toBe(p.text);
    const marked = parts.filter((p) => p.ann);
    expect(marked.map((p) => p.text).join("")).toBe("wombat summons");
    expect(marked.at(-1)?.lastOfAnn).toBe(true);
    expect(groups.some((g) => g.mark?.type === "principle")).toBe(true);
  });
  it("splits a student mark that crosses one of Lawdeck's highlights", () => {
    const placed = placeAnnotation(ann({ start: 40, end: 60, quote: text.slice(40, 60) }), content)!;
    const groups = paragraphGroups(text, [{ start: 52, end: 61, type: "principle" }], [placed]);
    const marked = groups.flatMap((g) => g.parts.filter((p) => p.ann));
    expect(marked.length).toBe(2);
    expect(marked.map((p) => p.text).join("")).toBe(text.slice(40, 60));
  });
});
