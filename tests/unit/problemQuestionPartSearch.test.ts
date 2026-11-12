import { describe, expect, it, vi } from "vitest";

// Pretend search service and Claude: nothing is spent. A question in lettered parts is searched
// part by part with no AI call to list its issues (founder, 2026-11-12).
const rpc = vi.fn(async () => ({ data: [], error: null }));
const listIssues = vi.fn(async () => ["issue one"]);
vi.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("@/server/ai/issues", () => ({ listIssues }));
vi.mock("@/server/retrieval/voyage", () => ({
  embedTexts: async () => ({ ok: true, vectors: [[0.1]] }),
  toVectorText: () => "[0.1]",
}));
vi.mock("@/server/retrieval/rerank", () => ({ rerankTexts: async () => ({ ok: false }) }));
const { searchForQuestion } = await import("@/server/retrieval/search");

const facts = Array.from({ length: 45 }, (_, i) => `word${i}`).join(" ");

describe("searching a problem question", () => {
  it("uses the lettered parts instead of an AI call", async () => {
    await searchForQuestion({
      question: `${facts}. (a) Advise on the undefended list. (b) Draft the writ of summons.`,
      courseId: null,
      includePending: false,
      useUploads: false,
    });
    expect(listIssues).not.toHaveBeenCalled();
  });

  it("asks Claude for the issues when there are no parts", async () => {
    await searchForQuestion({ question: `${facts}. Advise him.`, courseId: null, includePending: false, useUploads: false });
    expect(listIssues).toHaveBeenCalledTimes(1);
  });
});
