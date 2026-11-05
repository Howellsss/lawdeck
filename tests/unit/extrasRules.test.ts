import { describe, expect, it } from "vitest";
import { acronymLetters, acronymMatches, MAX_AIDS, MAX_STORIES, selectAids, selectStories } from "@/lib/extrasRules";
import type { ExtrasReply } from "@/schemas/extras";

type Aid = ExtrasReply["memory_aids"][number];
type Story = ExtrasReply["stories"][number];
const aid = (over: Partial<Aid> = {}): Aid => ({
  after_section: 0,
  kind: "acronym",
  title: "Made-up elements",
  device: "WOM",
  items: [
    { key: "W", meaning: "Wish" },
    { key: "O", meaning: "Offer" },
    { key: "M", meaning: "Meeting" },
  ],
  explanation: "",
  sources: [1],
  ...over,
});
const story = (over: Partial<Story> = {}): Story => ({
  after_section: 0,
  kind: "everyday",
  title: "Ada sells a bicycle",
  authority: "",
  parts: [{ heading: "What happened", text: "A made-up story." }],
  takeaway: "A made-up takeaway.",
  question: "Which?",
  choices: ["This", "That"],
  correct_choice: 0,
  explanation: "Because.",
  sources: [1],
  ...over,
});

describe("acronyms", () => {
  it("reads the letters whatever the punctuation", () => expect(acronymLetters("W.o-m")).toBe("WOM"));
  it("keeps an acronym whose items spell it", () => expect(acronymMatches(aid())).toBe(true));
  it("drops one with a missing element", () => expect(acronymMatches(aid({ items: aid().items.slice(0, 2) }))).toBe(false));
  it("drops one whose letters are out of order", () =>
    expect(acronymMatches(aid({ items: [aid().items[1], aid().items[0], aid().items[2]] }))).toBe(false));
});

describe("selectAids", () => {
  it("keeps one aid per section and at most four", () => {
    const many = [0, 0, 1, 2, 3, 4, 5].map((s) => aid({ after_section: s }));
    const { kept, dropped } = selectAids(many, 9);
    expect(kept.map((a) => a.after_section)).toEqual([0, 1, 2, 3]);
    expect(kept).toHaveLength(MAX_AIDS);
    expect(dropped).toBe(3);
  });
  it("moves an aid past the last section onto the last section", () => expect(selectAids([aid({ after_section: 9 })], 2).kept[0]?.after_section).toBe(2));
  it("drops a broken acronym but keeps a phrase", () => {
    const { kept } = selectAids([aid({ device: "WOMB" }), aid({ kind: "phrase", device: "Wise owls meet", after_section: 1 })], 3);
    expect(kept.map((a) => a.kind)).toEqual(["phrase"]);
  });
});

describe("selectStories", () => {
  const authorities = [
    { key: "wombat-v-quokka", factsFromLibrary: true },
    { key: "possum-v-koala", factsFromLibrary: false },
  ];
  it("keeps a case story only when the library gives the case's facts", () => {
    const { kept, dropped } = selectStories(
      [story({ kind: "case", authority: "wombat-v-quokka" }), story({ kind: "case", authority: "possum-v-koala" }), story({ kind: "case", authority: "made-up-v-case" })],
      3,
      authorities,
    );
    expect(kept.map((s) => s.authority)).toEqual(["wombat-v-quokka"]);
    expect(dropped).toBe(2);
  });
  it("clears an everyday story's unknown authority", () => expect(selectStories([story({ authority: "made-up-v-case" })], 3, authorities).kept[0]?.authority).toBe(""));
  it("removes a question whose right answer is not among the choices", () => {
    const kept = selectStories([story({ correct_choice: 4 })], 3, authorities).kept[0];
    expect(kept?.question).toBe("");
    expect(kept?.choices).toEqual([]);
    expect(kept?.correct_choice).toBe(-1);
  });
  it("keeps at most three", () => expect(selectStories([0, 1, 2, 3, 4].map((s) => story({ after_section: s })), 9, authorities).kept).toHaveLength(MAX_STORIES));
});
