import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const rerankTexts = vi.fn();

vi.mock("@/server/auth/supabase", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("@/server/retrieval/voyage", () => ({
  embedTexts: async () => ({ ok: true, vectors: [[0.1]] }),
  toVectorText: () => "[0.1]",
}));
vi.mock("@/server/retrieval/rerank", () => ({ rerankTexts }));

const { searchLibrary } = await import("@/server/retrieval/search");

const row = (n: number) => ({
  passage_id: `p${n}`,
  item_id: "item",
  item_title: "Notes",
  heading: null,
  text: `passage ${n}`,
  page_from: null,
  page_to: null,
  score: 1 / n,
  meaning_rank: n,
  words_rank: null,
});
const rows = Array.from({ length: 30 }, (_, i) => row(i + 1));
const input = { question: "q", courseId: "c", includePending: false };

describe("library search with the re-ranker", () => {
  beforeEach(() => {
    rpc.mockReset();
    rerankTexts.mockReset();
  });

  it("asks the database for 30 candidates and keeps the re-ranker's best 8", async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    rerankTexts.mockResolvedValue({ ok: true, order: [29, 28, 0, 1, 2, 3, 4, 5, 6, 7] });
    const result = await searchLibrary(input);
    expect(rpc.mock.calls[0][1].match_count).toBe(30);
    expect(result.ok && result.reranked).toBe(true);
    expect(result.ok && result.hits.map((hit) => hit.passageId)).toEqual(["p30", "p29", "p1", "p2", "p3", "p4", "p5", "p6"]);
  });

  it("falls back to the search's own order when the re-ranker fails, and says so", async () => {
    rpc.mockResolvedValue({ data: rows, error: null });
    rerankTexts.mockResolvedValue({ ok: false, reason: "unavailable" });
    const result = await searchLibrary(input);
    expect(result.ok && result.reranked).toBe(false);
    expect(result.ok && result.hits.map((hit) => hit.passageId)).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]);
  });

  it("explains the search limit when the database refuses", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "LD429" } });
    const result = await searchLibrary(input);
    expect(result).toEqual({ ok: false, message: "You have reached the search limit for now. Please try again in an hour." });
    expect(rerankTexts).not.toHaveBeenCalled();
  });
});
