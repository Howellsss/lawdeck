import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOT_COVERED_TEXT, briefRequest } from "@/prompts/brief";
import { newBriefSchema } from "@/schemas/brief";
import type { FilterContext } from "@/server/learn/answerFilter";
import { cleanBrief } from "@/server/briefs/clean";

// Pretend search, Claude and database: nothing is spent. Made-up names only.
const searchLibrary = vi.fn();
const makeBrief = vi.fn();
const recordUsage = vi.fn();
const getAllowance = vi.fn();
vi.mock("@/server/retrieval/search", () => ({ searchLibrary }));
vi.mock("@/server/ai/brief", () => ({ makeBrief }));
vi.mock("@/server/ai/usage", () => ({ recordUsage }));
vi.mock("@/server/learn/allowance", () => ({
  getAllowance,
  hasQuestionsLeft: (a: { used: number; limit: number }) => a.used < a.limit,
  ALLOWANCE_UNAVAILABLE: "unavailable",
}));
vi.mock("@/server/learn/filterContext", () => ({
  filterContextFor: async () => ({ labels: new Set([1]), passageTexts: ["Wombat v Numbat decided six months."], statuteTexts: [], recognisedTitles: [] }),
}));
vi.mock("@/server/learn/ask", () => ({ searchUnsure: () => null }));
const { createBrief, lookupFor, notInLibraryMessage } = await import("@/server/briefs/create");

const context: FilterContext = { labels: new Set([1, 2]), passageTexts: ["Wombat v Numbat: six months."], statuteTexts: [], recognisedTitles: [] };
const section = (heading: string, over: Partial<{ covered: boolean; text: string; sources: number[] }> = {}) => ({
  heading,
  covered: true,
  text: `${heading} text [S1].`,
  sources: [1],
  ...over,
});

describe("brief requests", () => {
  it("checks the name and kind", () => {
    expect(newBriefSchema.parse({ kind: "case", name: "  Wombat   v. Numbat " })).toEqual({ kind: "case", name: "Wombat v. Numbat", course: "all" });
    expect(newBriefSchema.safeParse({ kind: "case", name: "x" }).success).toBe(false);
    expect(newBriefSchema.safeParse({ kind: "essay", name: "Wombat v Numbat" }).success).toBe(false);
  });

  it("looks up two-party cases by both names, and anything else as a phrase", () => {
    expect(lookupFor("case", "Wombat v. Numbat")).toEqual({ statutes: [], cases: ["wombat v numbat"] });
    expect(lookupFor("case", "Wombat vs Numbat")).toEqual({ statutes: [], cases: ["wombat v numbat"] });
    expect(lookupFor("statute", "Quokka (Civil Procedure) Rules, 2019")).toEqual({ statutes: ["quokka civil procedure rules 2019"], cases: [] });
  });

  it("wraps the name as a name only, and lists the sections to write", () => {
    const text = briefRequest({ passages: [], kind: "case", name: "<b>Wombat</b>" });
    expect(text).toContain("<name> b Wombat /b </name>");
    expect(text).toContain("Facts, Issues, Decision, Ratio, Relevance");
  });
});

describe("checking a brief", () => {
  it("keeps the fixed sections in order and says plainly what the library does not cover", async () => {
    const reply = { found: true, sections: [section("Ratio"), section("Facts"), section("Issues", { covered: false, text: "" }), section("Decision", { sources: [9] })] };
    const sections = await cleanBrief(reply, "case", context);
    expect(sections.map((s) => s.heading)).toEqual(["Facts", "Issues", "Decision", "Ratio", "Relevance"]);
    expect(sections[0]).toMatchObject({ covered: true, sources: [1] });
    expect(sections[1]).toEqual({ heading: "Issues", text: NOT_COVERED_TEXT, covered: false, sources: [] });
    // Cites only a passage that was not supplied: not covered.
    expect(sections[2].covered).toBe(false);
    expect(sections[4].covered).toBe(false);
  });
});

function fakeDb(mentioned: { phrase: string }[]) {
  const inserts: unknown[] = [];
  const db = {
    inserts,
    rpc: async () => ({ data: mentioned, error: null }),
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "c1" }, error: null }) }) }),
      insert(row: unknown) {
        inserts.push(row);
        return { select: () => ({ single: async () => ({ data: { id: "b1" }, error: null }) }) };
      },
    }),
  };
  return db;
}
const hit = { passageId: "p1", itemId: "i1", itemTitle: "Notes", heading: "Cases", text: "Wombat v Numbat.", pageFrom: 3, pageTo: 3, score: 1, meaningRank: 1, wordsRank: 1 };
const input = { kind: "case" as const, name: "Wombat v Numbat", course: "all" };
const made = (reply: unknown) => ({ ok: true, reply, model: "claude-sonnet-5-5", costUsd: 0.03, usage: { tokensIn: 1, tokensOut: 1, ms: 1 } });

describe("writing a brief", () => {
  beforeEach(() => {
    for (const fn of [searchLibrary, makeBrief, recordUsage, getAllowance]) fn.mockReset();
    getAllowance.mockResolvedValue({ used: 0, limit: 30, unlimited: false });
    searchLibrary.mockResolvedValue({ ok: true, hits: [hit], meaningUsed: true, reranked: true });
  });

  it("refuses, without calling the AI, when the name is not in the library", async () => {
    const result = await createBrief(fakeDb([]) as never, "u1", input);
    expect(result).toEqual({ ok: false, message: notInLibraryMessage("case") });
    expect(makeBrief).not.toHaveBeenCalled();
  });

  it("checks the monthly limit first", async () => {
    getAllowance.mockResolvedValue({ used: 30, limit: 30, unlimited: false });
    expect((await createBrief(fakeDb([{ phrase: "wombat v numbat" }]) as never, "u1", input)).ok).toBe(false);
    expect(searchLibrary).not.toHaveBeenCalled();
  });

  it("does not save or count a brief when no section is covered", async () => {
    makeBrief.mockResolvedValue(made({ found: true, sections: [section("Facts", { covered: false, text: "" })] }));
    const db = fakeDb([{ phrase: "wombat v numbat" }]);
    expect((await createBrief(db as never, "u1", input)).ok).toBe(false);
    expect(db.inserts).toHaveLength(0);
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("saves the brief with its sources (no passage text) and counts it once", async () => {
    makeBrief.mockResolvedValue(made({ found: true, sections: [section("Facts"), section("Ratio")] }));
    const db = fakeDb([{ phrase: "wombat v numbat" }]);
    expect(await createBrief(db as never, "u1", input)).toEqual({ ok: true, id: "b1" });
    const row = db.inserts[0] as { sections: { covered: boolean }[]; sources: Record<string, unknown>[] };
    expect(row.sections).toHaveLength(5);
    expect(row.sources).toEqual([{ label: 1, passageId: "p1", title: "Notes", heading: "Cases", pages: "p. 3" }]);
    expect(recordUsage).toHaveBeenCalledTimes(1);
    expect(recordUsage.mock.calls[0][0]).toMatchObject({ kind: "brief" });
  });
});
