import { beforeEach, describe, expect, it, vi } from "vitest";

const searchLibrary = vi.fn();
const streamExplanation = vi.fn();
vi.mock("@/server/retrieval/search", () => ({ searchLibrary }));
vi.mock("@/server/ai/explain", () => ({ streamExplanation }));

const rpc = vi.fn();
vi.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));

const { answerQuestion } = await import("@/server/learn/ask");
const { recordUsage } = await import("@/server/ai/usage");

// A database stand-in: the chat exists; every write is recorded.
function fakeDb(allowance: { data: unknown; error: unknown }) {
  const writes: string[] = [];
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    // The chat's earlier messages, read alongside the limit check.
    limit: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: { id: "chat-1", title: "Writs", course_id: null }, error: null }),
  };
  return {
    writes,
    db: {
      from: (table: string) => ({
        ...chain,
        insert: () => {
          writes.push(table);
          return { error: null };
        },
      }),
      rpc: async () => allowance,
    },
  };
}

async function ask(allowance: { data: unknown; error: unknown }) {
  const { db, writes } = fakeDb(allowance);
  const events: unknown[] = [];
  // The fake only implements what answerQuestion reads before the limit check.
  await answerQuestion({ db: db as never, userId: "u1", chatId: "chat-1", question: "What is a writ?", level: "simple", send: (e) => events.push(e) });
  return { events, writes };
}

describe("the monthly question limit", () => {
  beforeEach(() => {
    searchLibrary.mockReset();
    streamExplanation.mockReset();
  });

  it("stops at the limit before saving the question or calling any AI", async () => {
    const { events, writes } = await ask({ data: [{ used: 30, monthly_limit: 30, unlimited: false }], error: null });
    expect(events).toEqual([{ type: "error", message: expect.stringContaining("You’ve used all 30 questions for this month") }]);
    expect(writes).toEqual([]);
    expect(searchLibrary).not.toHaveBeenCalled();
    expect(streamExplanation).not.toHaveBeenCalled();
  });

  it("does not call the AI when the limit cannot be checked", async () => {
    const { events } = await ask({ data: null, error: { code: "PGRST202" } });
    expect(events).toEqual([{ type: "error", message: expect.stringContaining("couldn’t check your questions") }]);
    expect(streamExplanation).not.toHaveBeenCalled();
  });
});

describe("recording AI usage", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("sends model, tokens, cost and time to the database, rounded", async () => {
    rpc.mockResolvedValue({ error: null });
    await recordUsage({ kind: "explain", model: "claude-sonnet-5-5", tokensIn: 1200.4, tokensOut: 300, costUsd: null, ms: 2100.7 });
    expect(rpc).toHaveBeenCalledWith("record_ai_usage", {
      kind: "explain",
      model: "claude-sonnet-5-5",
      tokens_in: 1200,
      tokens_out: 300,
      cost_usd: 0,
      duration_ms: 2101,
    });
  });

  it("never stops an answer when recording fails", async () => {
    rpc.mockImplementation(async () => {
      throw new Error("down");
    });
    await expect(recordUsage({ kind: "route", model: "m", tokensIn: 1, tokensOut: 1, costUsd: 0, ms: 1 })).resolves.toBeUndefined();
  });
});
