import { beforeEach, describe, expect, it, vi } from "vitest";
import { partSearches, splitParts } from "@/lib/questionParts";
import { ANSWER_EVERY_PART_NOTE, NOT_ENOUGH_MARKER } from "@/prompts/explain";

// Founder, 2026-11-12: a six-part problem question was answered "Not enough in the Lawdeck
// library" although the library covers it. Pretend Claude and usage record: nothing is spent.
const streamExplanation = vi.fn();
const recordUsage = vi.fn();
vi.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/server/ai/explain", () => ({ streamExplanation }));
vi.mock("@/server/ai/usage", () => ({ recordUsage }));
vi.mock("@/server/learn/filterContext", () => ({
  filterContextFor: async (_db: unknown, hits: { label: number; text: string }[]) => ({
    labels: new Set(hits.map((h) => h.label)),
    passageTexts: hits.map((h) => h.text),
    statuteTexts: [],
    recognisedTitles: [],
    lookup: async () => new Set(),
  }),
}));
const { composeAnswer } = await import("@/server/learn/ask");
const { NOT_ENOUGH_HEADING } = await import("@/server/learn/answerFilter");

const FACTS =
  "Mr Quokka lent Mrs Wombat five million naira in Abuja, repayable in six months. She has refused to pay despite several demands, and her only known asset is money in her account with Numbat Bank. Mr Quokka wants the money back quickly and asks for your advice as his counsel.";
const QUESTION = `${FACTS}
(a) Advise on the procedure for recovering the debt under the undefended list.
(b) State the documents to be filed with the writ.
(c) Draft the writ of summons.
(d) Draft the statement of claim.
(e) Explain how the judgment can be enforced against the bank account.
(f) State what happens if Mrs Wombat files a notice of intention to defend.`;

describe("the parts of a problem question", () => {
  it("finds lettered parts and keeps the facts apart", () => {
    const found = splitParts(QUESTION);
    expect(found?.facts).toBe(FACTS);
    expect(found?.parts.map((p) => p.label)).toEqual(["(a)", "(b)", "(c)", "(d)", "(e)", "(f)"]);
    expect(found?.parts[2].text).toBe("Draft the writ of summons.");
  });

  it("finds parts written on one line and roman numerals", () => {
    expect(splitParts("Facts here. (a) Advise the bank. (b) Advise the customer.")?.parts.map((p) => p.text)).toEqual([
      "Advise the bank.",
      "Advise the customer.",
    ]);
    expect(splitParts("Facts: (i) Is the contract valid? (ii) What remedies exist?")?.parts).toHaveLength(2);
  });

  it("does not mistake section numbers or a single bracket for parts", () => {
    expect(splitParts("Explain section 20(a) and section 21(b) of the Act in detail please.")).toBeNull();
    expect(splitParts("Facts. (a) Advise the bank.")).toBeNull();
    expect(splitParts("Facts. (a) Advise him. (c) Advise her.")).toBeNull();
  });

  it("searches every part in at most four searches", () => {
    const parts = splitParts(QUESTION)!.parts;
    const searches = partSearches(parts, 4);
    expect(searches).toHaveLength(3);
    for (const part of parts) expect(searches.some((s) => s.includes(part.text))).toBe(true);
    expect(partSearches(parts.slice(0, 2), 4)).toHaveLength(2);
  });
});

const hits = [
  {
    passageId: "p1",
    itemId: "i1",
    itemTitle: "Civil litigation notes",
    heading: "Undefended list",
    text: "A claim for a debt may be placed on the undefended list.",
    pageFrom: 1,
    pageTo: 1,
    score: 1,
    meaningRank: 1,
    wordsRank: 1,
  },
];

const reply = (text: string) => async (input: { onText: (t: string) => void }) => {
  input.onText(text);
  return { ok: true, model: "m", tokensIn: 100, tokensOut: 10, costUsd: 0.01, stop: "end_turn", firstTextMs: 1, ms: 5 };
};

const ask = (question: string, level: "exam" | "talk" = "exam") => {
  const seen: string[] = [];
  return composeAnswer({
    db: {} as never,
    hits,
    question,
    level,
    history: [],
    courseId: null,
    userId: "u",
    onText: (t) => seen.push(t),
  }).then((composed) => ({ composed, seen: seen.join("") }));
};

beforeEach(() => {
  streamExplanation.mockReset();
  recordUsage.mockReset();
});

describe("a problem question with library passages is never declined as a whole", () => {
  it("asks once more, part by part, and the student never sees the decline", async () => {
    streamExplanation
      .mockImplementationOnce(reply(`${NOT_ENOUGH_MARKER}\nThe library has no template for a writ.`))
      .mockImplementationOnce(reply("## The facts in brief\nMr Quokka is owed money [S1]."));
    const { composed, seen } = await ask(QUESTION);
    expect(streamExplanation).toHaveBeenCalledTimes(2);
    expect(streamExplanation.mock.calls[1][0].turns.at(-1).text).toContain(ANSWER_EVERY_PART_NOTE);
    expect(seen).not.toContain(NOT_ENOUGH_HEADING);
    expect(seen).not.toContain("template");
    expect(composed.ok && composed.notEnough).toBe(false);
    expect(composed.ok && composed.shown).toContain("## The facts in brief");
    // Both tries count as one question, with both costs logged.
    expect(recordUsage).toHaveBeenCalledTimes(1);
    expect(recordUsage.mock.calls[0][0]).toMatchObject({ kind: "explain", tokensIn: 200, tokensOut: 20, costUsd: 0.02 });
    // Neither try records a question on its own.
    for (const call of streamExplanation.mock.calls) expect(call[0].record).toBe(false);
  });

  it("asks only once when the first answer is fine", async () => {
    streamExplanation.mockImplementationOnce(reply("## The facts in brief\nMr Quokka is owed money [S1]."));
    await ask(QUESTION);
    expect(streamExplanation).toHaveBeenCalledTimes(1);
    expect(recordUsage).toHaveBeenCalledTimes(1);
  });

  it("is honest if the second try still finds nothing", async () => {
    streamExplanation.mockImplementation(reply(`${NOT_ENOUGH_MARKER}\nNothing on this.`));
    const { composed, seen } = await ask(QUESTION);
    expect(streamExplanation).toHaveBeenCalledTimes(2);
    expect(seen.startsWith(NOT_ENOUGH_HEADING)).toBe(true);
    expect(composed.ok && composed.notEnough).toBe(true);
  });

  it("leaves a short question's 'not enough' as it is", async () => {
    streamExplanation.mockImplementation(reply(`${NOT_ENOUGH_MARKER}\nNothing on this.`));
    const { composed } = await ask("What is a quokka writ?");
    expect(streamExplanation).toHaveBeenCalledTimes(1);
    expect(streamExplanation.mock.calls[0][0].record).toBe(true);
    expect(composed.ok && composed.notEnough).toBe(true);
  });
});
