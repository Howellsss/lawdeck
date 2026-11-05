import { describe, expect, it, vi } from "vitest";
import type { LessonReply } from "@/schemas/lesson";
import type { FilterContext } from "@/server/learn/answerFilter";

vi.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: async () => ({}) }));
const { cleanLesson, lessonSources } = await import("@/server/lessons/clean");
const { REMOVED_AUTHORITY } = await import("@/server/learn/answerFilter");
const { parseLessonReply, parseOutline } = await import("@/server/ai/lesson");

// Made-up names and text: the checks, not legal content.
const context: FilterContext = {
  labels: new Set([1, 2]),
  passageTexts: ["Wombat v Quokka decided that a summons suits questions of construction."],
  statuteTexts: [],
  recognisedTitles: [],
};

function reply(overrides: Partial<LessonReply> = {}): LessonReply {
  return {
    found: true,
    title: "Quokka summons",
    sections: [
      {
        heading: "When to use it",
        paragraphs: [
          {
            text: "A summons suits questions of construction, as Wombat v Quokka shows. Kangaroo v Emu said otherwise.",
            sources: [1, 7],
            marks: [
              { type: "case", phrase: "Wombat v Quokka", authority: "wombat-v-quokka" },
              { type: "case", phrase: "Kangaroo v Emu", authority: "kangaroo-v-emu" },
            ],
          },
        ],
      },
    ],
    authorities: [
      { key: "wombat-v-quokka", kind: "case", name: "Wombat v Quokka", citation: "", court: "", facts: "Made-up facts.", issue: "", decision: "", principle: "A summons suits construction.", facts_from_library: false, sources: [1] },
      { key: "kangaroo-v-emu", kind: "case", name: "Kangaroo v Emu", citation: "", court: "", facts: "", issue: "", decision: "", principle: "Invented.", facts_from_library: false, sources: [9] },
    ],
    checkpoints: [
      { after_section: 0, placement: "reading", kind: "authority", prompt: "Which case shows when a summons suits?", choices: [], correct_choice: -1, answer: "Wombat v Quokka", explanation: "", key_point: "summons for construction", sources: [1] },
      { after_section: 0, placement: "reading", kind: "authority", prompt: "Which case said otherwise?", choices: [], correct_choice: -1, answer: "Kangaroo v Emu", explanation: "", key_point: "invented case", sources: [] },
      { after_section: 0, placement: "test", kind: "mcq", prompt: "Pick one", choices: ["Only one option"], correct_choice: 0, answer: "x", explanation: "", key_point: "broken mcq", sources: [] },
      { after_section: 5, placement: "reading", kind: "short", prompt: "What does a summons suit?", choices: [], correct_choice: -1, answer: "Questions of construction", explanation: "", key_point: "summons use", sources: [2] },
    ],
    ...overrides,
  };
}

describe("checking a lesson before it is saved", () => {
  it("drops an authority the library cannot confirm, and its marks", async () => {
    const clean = await cleanLesson(reply(), context);
    expect(clean.authorities.map((a) => a.key)).toEqual(["wombat-v-quokka"]);
    const paragraph = clean.content.sections[0].paragraphs[0];
    expect(paragraph.text).toContain(REMOVED_AUTHORITY);
    expect(paragraph.marks.map((m) => paragraph.text.slice(m.start, m.end))).toEqual(["Wombat v Quokka"]);
  });

  it("keeps facts out of a card unless the library gives them", async () => {
    const clean = await cleanLesson(reply(), context);
    expect(clean.authorities[0].facts).toBeNull();
    expect(clean.authorities[0].facts_from_library).toBe(false);
  });

  it("drops questions that name an unconfirmed authority or are broken, and keeps sources real", async () => {
    const clean = await cleanLesson(reply(), context);
    expect(clean.checkpoints.map((c) => c.key_point)).toEqual(["summons for construction", "summons use"]);
    expect(clean.removed).toBe(3);
    expect(clean.content.sections[0].paragraphs[0].sources).toEqual([1]);
    // A question placed after a section that does not exist moves to the last real section.
    expect(clean.checkpoints[1].after_section).toBe(0);
    expect(clean.checkpoints.map((c) => c.position)).toEqual([0, 1]);
    expect(clean.usedLabels).toEqual([1, 2]);
  });

  it("lists sources by passage, never their text", () => {
    const sources = lessonSources([1], [{ label: 1, passageId: "p1", itemTitle: "Notes", heading: "Summons", pages: "p. 4" }]);
    expect(sources).toEqual([{ label: 1, passageId: "p1", title: "Notes", heading: "Summons", pages: "p. 4" }]);
  });
});

describe("reading Claude's replies", () => {
  it("rejects a malformed lesson and accepts a valid one", () => {
    expect(parseLessonReply("not json")).toBeNull();
    expect(parseLessonReply(JSON.stringify({ found: true }))).toBeNull();
    expect(parseLessonReply(JSON.stringify(reply()))?.title).toBe("Quokka summons");
  });

  it("reads up to six search phrases from the outline", () => {
    expect(parseOutline("1. Service\n- Service\n* Appearance\n\nx\nA\nB\nC\nD\nE")).toEqual(["Service", "Appearance"]);
  });
});
