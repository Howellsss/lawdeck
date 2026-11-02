import { describe, expect, it, vi } from "vitest";
import { MAX_ISSUES, parseIssues } from "@/prompts/issues";
import type { SearchHit } from "@/server/retrieval/search";

vi.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: async () => ({}) }));
const { mergeHits } = await import("@/server/retrieval/search");
const { historyTurns } = await import("@/server/learn/ask");
const { NOT_ENOUGH_HEADING } = await import("@/server/learn/answerFilter");

const hit = (id: string): SearchHit => ({
  passageId: id,
  itemId: "item",
  itemTitle: "Notes",
  heading: null,
  text: "text",
  pageFrom: null,
  pageTo: null,
  score: 1,
  meaningRank: null,
  wordsRank: null,
});
const ids = (hits: SearchHit[]) => hits.map((h) => h.passageId);

describe("listing the issues in a problem question", () => {
  it("reads one issue per line without bullets or numbers", () => {
    expect(parseIssues("1. Service outside jurisdiction\n- Interlocutory injunction\n\n* Locus standi")).toEqual([
      "Service outside jurisdiction",
      "Interlocutory injunction",
      "Locus standi",
    ]);
  });

  it("keeps at most the allowed number, without repeats or empty lines", () => {
    const reply = ["a issue one", "A issue one", "b issue two", "c issue three", "d issue four", "e issue five", "x"].join("\n");
    const issues = parseIssues(reply);
    expect(issues).toHaveLength(MAX_ISSUES);
    expect(issues[1]).toBe("b issue two");
  });
});

describe("combining the passages for a problem question", () => {
  it("keeps the whole question's best passages first, then gives every issue a turn", () => {
    const whole = ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9", "w10"].map(hit);
    const merged = mergeHits(whole, [["a1", "a2"].map(hit), ["b1", "w2", "b2"].map(hit)], 20);
    expect(ids(merged)).toEqual(["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "a1", "b1", "a2", "b2", "w9", "w10"]);
  });

  it("never repeats a passage and stops at the maximum", () => {
    const merged = mergeHits(["w1", "w2"].map(hit), [["w1", "a1", "a2"].map(hit)], 3);
    expect(ids(merged)).toEqual(["w1", "w2", "a1"]);
  });
});

describe("asking again after a 'not enough' reply", () => {
  it("leaves the earlier 'not enough' reply out of the conversation", () => {
    // Newest first, as the database returns them.
    const rows = [
      { role: "assistant" as const, content: { text: "A full answer." } },
      { role: "user" as const, content: { text: "Second question" } },
      { role: "assistant" as const, content: { text: `${NOT_ENOUGH_HEADING}\nThe library has nothing.` } },
      { role: "user" as const, content: { text: "First question" } },
    ];
    const turns = historyTurns(rows);
    expect(turns.some((t) => t.text.startsWith(NOT_ENOUGH_HEADING))).toBe(false);
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(turns[0].text).toBe("Second question");
  });
});
