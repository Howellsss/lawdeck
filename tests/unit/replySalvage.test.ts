import { describe, expect, it } from "vitest";
import { slugKey, tidySources } from "@/lib/replySalvage";
import { parseLessonReply } from "@/server/ai/lesson";
import { parseExtrasReply } from "@/server/ai/extras";

const authority = (key: string) => ({
  key,
  kind: "case",
  name: "Wombat v Quokka",
  citation: "",
  court: "",
  facts: "",
  issue: "",
  decision: "",
  principle: "A made-up principle.",
  facts_from_library: false,
  sources: [1],
});
const checkpoint = (over: Record<string, unknown> = {}) => ({
  after_section: 0,
  placement: "reading",
  kind: "short",
  prompt: "Which made-up court?",
  choices: [],
  correct_choice: -1,
  answer: "The High Court",
  explanation: "",
  key_point: "which court",
  sources: [1],
  ...over,
});
const lesson = (over: Record<string, unknown> = {}) => ({
  found: true,
  title: "Wombat summons",
  sections: [
    {
      heading: "One",
      paragraphs: [{ text: "Made-up text about Wombat v Quokka.", sources: [1], marks: [{ type: "case", phrase: "Wombat v Quokka", authority: "Wombat-v-Quokka" }] }],
    },
  ],
  authorities: [authority("wombat-v-quokka")],
  checkpoints: [checkpoint()],
  ...over,
});

describe("tidying a paid reply instead of throwing it away", () => {
  it("turns any authority id into the allowed form", () => expect(slugKey("Ibrahim v. State (1999)")).toBe("ibrahim-v-state-1999"));
  it("keeps passage ids in range, once each, up to the limit", () => expect(tidySources([1, 1, 0, 200, 2.5, 3], 2)).toEqual([1, 3]));

  it("keeps a lesson whose authority id has capitals, and fixes the mark that names it", () => {
    const reply = parseLessonReply(JSON.stringify(lesson({ authorities: [authority("Wombat v Quokka")] })));
    expect(reply?.authorities[0]?.key).toBe("wombat-v-quokka");
    expect(reply?.sections[0]?.paragraphs[0]?.marks[0]?.authority).toBe("wombat-v-quokka");
  });
  it("drops only the faulty question, not the lesson", () => {
    const reply = parseLessonReply(JSON.stringify(lesson({ checkpoints: [checkpoint(), checkpoint({ kind: "riddle" }), checkpoint({ after_section: 40 })] })));
    expect(reply?.checkpoints).toHaveLength(2);
    expect(reply?.checkpoints[1]?.after_section).toBe(13);
  });
  it("keeps a paragraph that lists too many passages", () => {
    const many = Array.from({ length: 30 }, (_, i) => i + 1);
    const reply = parseLessonReply(JSON.stringify(lesson({ sections: [{ heading: "One", paragraphs: [{ text: "Made-up text.", sources: many, marks: [] }] }] })));
    expect(reply?.sections[0]?.paragraphs[0]?.sources).toHaveLength(20);
  });
  it("still refuses a reply that is not a lesson at all", () => {
    expect(parseLessonReply("not json")).toBeNull();
    expect(parseLessonReply(JSON.stringify({ found: true }))).toBeNull();
  });
  it("keeps good memory aids when one story is faulty", () => {
    const reply = parseExtrasReply(
      JSON.stringify({
        found: true,
        memory_aids: [{ after_section: 0, kind: "phrase", title: "Made-up list", device: "Wise owls meet", items: [{ key: "Wise", meaning: "Wish" }], explanation: "", sources: [1] }],
        stories: [{ after_section: 0, kind: "legend", title: "x" }],
      }),
    );
    expect(reply?.memory_aids).toHaveLength(1);
    expect(reply?.stories).toHaveLength(0);
  });
});
