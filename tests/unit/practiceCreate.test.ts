import { beforeEach, describe, expect, it, vi } from "vitest";

// The whole "make a practice set" flow with pretend search, Claude and database: nothing is spent.
const searchLibrary = vi.fn();
const makePracticeQuestions = vi.fn();
const recordUsage = vi.fn();
const getAllowance = vi.fn();
vi.mock("@/server/retrieval/search", () => ({ searchLibrary }));
vi.mock("@/server/ai/practice", () => ({ makePracticeQuestions }));
vi.mock("@/server/ai/usage", () => ({ recordUsage }));
vi.mock("@/server/learn/allowance", () => ({
  getAllowance,
  hasQuestionsLeft: (a: { used: number; limit: number }) => a.used < a.limit,
  ALLOWANCE_UNAVAILABLE: "unavailable",
}));
vi.mock("@/server/learn/filterContext", () => ({
  filterContextFor: async () => ({ labels: new Set([1]), passageTexts: ["Six months."], statuteTexts: [], recognisedTitles: [] }),
}));
vi.mock("@/server/learn/ask", () => ({ searchUnsure: () => null }));
const { createPracticeSet, NOT_ENOUGH_FOR_PRACTICE } = await import("@/server/practice/create");

const inserted: Record<string, unknown[]> = {};
function fakeDb() {
  return {
    from(table: string) {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "t1", name: "Writs", course_id: "c1" }, error: null }) }) }),
        insert(rows: unknown) {
          (inserted[table] ??= []).push(rows);
          return Object.assign(Promise.resolve({ error: null }), {
            select: () => ({ single: async () => ({ data: { id: "set1" }, error: null }) }),
          });
        },
        delete: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  } as never;
}

const hit = { passageId: "p1", itemId: "i1", itemTitle: "Notes", heading: null, text: "Six months.", pageFrom: 1, pageTo: 1, score: 1, meaningRank: 1, wordsRank: 1 };
const good = { question: "How long?", choices: ["Three months", "Six months"], correctChoice: 1, answer: "Six months [S1].", sources: [1] };
const input = { topicId: "11111111-1111-4111-8111-111111111111", kind: "mcq" as const, count: 5 };

beforeEach(() => {
  for (const fn of [searchLibrary, makePracticeQuestions, recordUsage, getAllowance]) fn.mockReset();
  for (const key of Object.keys(inserted)) delete inserted[key];
  getAllowance.mockResolvedValue({ used: 0, limit: 30, unlimited: false });
  searchLibrary.mockResolvedValue({ ok: true, hits: [hit], meaningUsed: true, reranked: true });
});

describe("making a practice set", () => {
  it("checks the monthly limit before any search or AI call", async () => {
    getAllowance.mockResolvedValue({ used: 30, limit: 30, unlimited: false });
    const result = await createPracticeSet(fakeDb(), "u1", input);
    expect(result.ok).toBe(false);
    expect(searchLibrary).not.toHaveBeenCalled();
    expect(makePracticeQuestions).not.toHaveBeenCalled();
  });

  it("says the library has too little, without calling the AI, when nothing is found", async () => {
    searchLibrary.mockResolvedValue({ ok: true, hits: [], meaningUsed: true, reranked: true });
    expect(await createPracticeSet(fakeDb(), "u1", input)).toEqual({ ok: false, message: NOT_ENOUGH_FOR_PRACTICE });
    expect(makePracticeQuestions).not.toHaveBeenCalled();
  });

  it("does not count or save a set when no question passes the checks", async () => {
    makePracticeQuestions.mockResolvedValue({
      ok: true,
      reply: { notEnough: true, items: [{ ...good, sources: [] }] },
      model: "claude-sonnet-5-5",
      costUsd: 0.03,
      usage: { tokensIn: 1, tokensOut: 1, ms: 1 },
    });
    expect(await createPracticeSet(fakeDb(), "u1", input)).toEqual({ ok: false, message: NOT_ENOUGH_FOR_PRACTICE });
    expect(recordUsage).not.toHaveBeenCalled();
    expect(inserted.practice_sets).toBeUndefined();
  });

  it("saves the set with sources (no passage text) and counts it once", async () => {
    makePracticeQuestions.mockResolvedValue({
      ok: true,
      reply: { notEnough: false, items: [good] },
      model: "claude-sonnet-5-5",
      costUsd: 0.03,
      usage: { tokensIn: 1, tokensOut: 1, ms: 1 },
    });
    expect(await createPracticeSet(fakeDb(), "u1", input)).toEqual({ ok: true, id: "set1", dropped: 0 });
    const rows = inserted.practice_items[0] as { sources: Record<string, unknown>[]; correct_choice: number }[];
    expect(rows[0].correct_choice).toBe(1);
    expect(rows[0].sources[0]).toEqual({ label: 1, passageId: "p1", title: "Notes", heading: null, pages: "p. 1" });
    expect(recordUsage).toHaveBeenCalledTimes(1);
    expect(recordUsage.mock.calls[0][0]).toMatchObject({ kind: "practice" });
  });

  it("writes a larger set as small batches at once, each from its own passages, counting the cost once", async () => {
    const hits = [1, 2, 3, 4].map((n) => ({ ...hit, passageId: `p${n}`, text: `Passage ${n}.` }));
    searchLibrary.mockResolvedValue({ ok: true, hits, meaningUsed: true, reranked: true });
    makePracticeQuestions.mockImplementation(async (call: { passages: { label: number }[]; count: number }) => ({
      ok: true,
      reply: { notEnough: false, items: call.passages.slice(0, call.count).map((p) => ({ ...good, sources: [p.label] })) },
      model: "claude-sonnet-5-5",
      costUsd: 0.02,
      usage: { tokensIn: 10, tokensOut: 20, ms: 1000 },
    }));
    const result = await createPracticeSet(fakeDb(), "u1", { ...input, count: 6 });
    expect(result).toMatchObject({ ok: true });
    const calls = makePracticeQuestions.mock.calls.map(([call]) => call as { passages: { label: number }[]; count: number });
    expect(calls.map((call) => call.count)).toEqual([3, 3]);
    expect(calls.map((call) => call.passages.map((p) => p.label))).toEqual([[1, 3], [2, 4]]);
    expect(recordUsage).toHaveBeenCalledTimes(1);
    expect(recordUsage.mock.calls[0][0]).toMatchObject({ kind: "practice", costUsd: 0.04, tokensIn: 20, tokensOut: 40, ms: 1000 });
  });

  it("keeps the questions from batches that worked when another batch fails", async () => {
    searchLibrary.mockResolvedValue({ ok: true, hits: [hit, { ...hit, passageId: "p2" }], meaningUsed: true, reranked: true });
    makePracticeQuestions
      .mockResolvedValueOnce({ ok: true, reply: { notEnough: false, items: [good] }, model: "claude-sonnet-5-5", costUsd: 0.02, usage: { tokensIn: 1, tokensOut: 1, ms: 1 } })
      .mockResolvedValueOnce({ ok: false, reason: "busy" });
    expect(await createPracticeSet(fakeDb(), "u1", { ...input, count: 6 })).toMatchObject({ ok: true });
  });
});
