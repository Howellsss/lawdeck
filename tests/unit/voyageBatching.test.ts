import { describe, expect, it } from "vitest";
import { EMBED_TOKEN_BUDGET, estimateTokens, fitTokenBudget } from "@/server/retrieval/voyage";

// Library passages are sent to Voyage in batches that fit its smallest per-minute limit
// (about 10,000 tokens for accounts without a payment method).
const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");

describe("Voyage batch sizing", () => {
  it("estimates tokens cautiously", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcdef")).toBe(2);
  });

  it("keeps a batch of long passages under the budget", () => {
    const passages = Array.from({ length: 32 }, () => words(800)); // about 1,300 tokens each
    const count = fitTokenBudget(passages);
    const used = passages.slice(0, count).reduce((sum, text) => sum + estimateTokens(text), 0);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(32);
    expect(used).toBeLessThanOrEqual(EMBED_TOKEN_BUDGET);
  });

  it("sends short passages together", () => {
    expect(fitTokenBudget(Array.from({ length: 32 }, () => words(20)))).toBe(32);
  });

  it("always sends at least one passage, even a very long one", () => {
    expect(fitTokenBudget([words(20_000), words(10)])).toBe(1);
  });
});
