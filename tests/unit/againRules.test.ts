import { describe, expect, it } from "vitest";
import { keepsAllPoints, sameStory } from "@/lib/againRules";

const items = [
  { key: "W", meaning: "Wish" },
  { key: "O", meaning: "Offer" },
  { key: "M", meaning: "Meeting" },
];
const aid = (over: object = {}) => ({ after_section: 0, kind: "acronym" as const, title: "Made-up", device: "WOM", items, explanation: "", sources: [], ...over });
const story = (over: object = {}) => ({
  after_section: 0,
  kind: "everyday" as const,
  title: "Made-up",
  authority: "",
  parts: [{ heading: "What happened", text: "Made-up." }],
  takeaway: "Made-up.",
  question: "",
  choices: [],
  correct_choice: -1,
  explanation: "",
  sources: [],
  ...over,
});

describe("another memory aid", () => {
  it("keeps one that covers the same points", () => expect(keepsAllPoints({ items }, aid({ kind: "phrase", device: "Wise owls meet" }))).toBe(true));
  it("refuses one that leaves a point out", () => expect(keepsAllPoints({ items }, aid({ kind: "phrase", items: items.slice(0, 2) }))).toBe(false));
  it("refuses an acronym its items do not spell", () => expect(keepsAllPoints({ items }, aid({ device: "MOW" }))).toBe(false));
});

describe("tell it another way", () => {
  it("keeps the same kind of story", () => expect(sameStory({ kind: "everyday", authorityKey: null }, story())).toBe(true));
  it("refuses an everyday story turned into a case story", () => expect(sameStory({ kind: "everyday", authorityKey: null }, story({ kind: "case" }))).toBe(false));
  it("keeps a case story to the same case", () => {
    expect(sameStory({ kind: "case", authorityKey: "wombat-v-quokka" }, story({ kind: "case", authority: "wombat-v-quokka" }))).toBe(true);
    expect(sameStory({ kind: "case", authorityKey: "wombat-v-quokka" }, story({ kind: "case", authority: "emu-v-koala" }))).toBe(false);
  });
});
