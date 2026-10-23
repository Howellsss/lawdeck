import { beforeEach, describe, expect, it, vi } from "vitest";
import { passagesBlock } from "@/prompts/explain";

// Pretend database, search service and Claude: nothing is spent. Made-up names only.
const rpc = vi.fn();
const rerankTexts = vi.fn();
const streamExplanation = vi.fn();
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));
vi.mock("@/server/retrieval/voyage", () => ({
  embedTexts: async () => ({ ok: true, vectors: [[0.1]] }),
  toVectorText: () => "[0.1]",
}));
vi.mock("@/server/retrieval/rerank", () => ({ rerankTexts }));
vi.mock("@/server/ai/explain", () => ({ streamExplanation }));
vi.mock("@/server/learn/filterContext", () => ({
  // The test's library: only what the library passages handed in contain.
  filterContextFor: async (
    _db: unknown,
    hits: { label: number; text: string }[],
  ) => ({
    labels: new Set(hits.map((h) => h.label)),
    passageTexts: hits.map((h) => h.text),
    statuteTexts: [],
    recognisedTitles: [],
    lookup: async () => new Set(),
  }),
}));
const { searchForAnswer, interleave } =
  await import("@/server/retrieval/search");
const { composeAnswer } = await import("@/server/learn/ask");

const libraryRow = {
  passage_id: "lib1",
  item_id: "i1",
  item_title: "Quokka notes",
  heading: "Writs",
  text: "A quokka writ lasts six months, as held in Wombat v Numbat.",
  page_from: 3,
  page_to: 3,
  score: 1,
  meaning_rank: 1,
  words_rank: 1,
};
const uploadRow = {
  passage_id: "up1",
  upload_id: "u1",
  file_name: "My class notes.pdf",
  heading: null,
  text: "My note: renew within twelve months, see Echidna v Platypus.",
  page_from: 1,
  page_to: 1,
  score: 1,
  meaning_rank: 1,
  words_rank: 1,
};

beforeEach(() => {
  rpc.mockReset();
  rerankTexts.mockReset();
  streamExplanation.mockReset();
  rpc.mockImplementation(async (fn: string) => ({
    data: fn === "search_library" ? [libraryRow] : [uploadRow],
    error: null,
  }));
});

describe("searching for an answer", () => {
  it("searches the student's uploads only when the chat uses them", async () => {
    rerankTexts.mockResolvedValue({ ok: false });
    await searchForAnswer({
      question: "renewal",
      courseId: null,
      includePending: false,
      useUploads: false,
    });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["search_library"]);
    rpc.mockClear();
    const result = await searchForAnswer({
      question: "renewal",
      courseId: null,
      includePending: false,
      useUploads: true,
    });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual([
      "search_library",
      "search_uploads",
    ]);
    expect(
      result.ok && result.hits.map((h) => [h.passageId, h.origin, h.itemTitle]),
    ).toEqual([
      ["lib1", "library", "Quokka notes"],
      ["up1", "upload", "My class notes.pdf"],
    ]);
  });

  it("ranks library and upload passages together when the re-ranker works", async () => {
    rerankTexts.mockResolvedValue({ ok: true, order: [1, 0] });
    const result = await searchForAnswer({
      question: "renewal",
      courseId: null,
      includePending: false,
      useUploads: true,
    });
    expect(result.ok && result.hits.map((h) => h.origin)).toEqual([
      "upload",
      "library",
    ]);
  });

  it("still answers from the library if the upload search fails", async () => {
    rerankTexts.mockResolvedValue({ ok: false });
    rpc.mockImplementation(async (fn: string) =>
      fn === "search_library"
        ? { data: [libraryRow], error: null }
        : { data: null, error: { code: "XX000" } },
    );
    const result = await searchForAnswer({
      question: "renewal",
      courseId: null,
      includePending: false,
      useUploads: true,
    });
    expect(result.ok && result.hits.map((h) => h.origin)).toEqual(["library"]);
  });

  it("takes results in turn without the re-ranker", () => {
    expect(interleave<string | number>([1, 2, 3], ["a"])).toEqual([1, "a", 2, 3]);
  });
});

describe("the answer", () => {
  it("marks each passage's origin for Claude", () => {
    const block = passagesBlock([
      {
        label: 1,
        itemTitle: "Quokka notes",
        heading: null,
        pages: null,
        text: "x",
      },
      {
        label: 2,
        itemTitle: "My class notes.pdf",
        heading: null,
        pages: null,
        text: "y",
        origin: "upload",
      },
    ]);
    expect(block).toContain('<passage id="S1" origin="library"');
    expect(block).toContain('<passage id="S2" origin="student upload"');
  });

  it("can cite an upload, but removes an authority found only in the student's notes", async () => {
    streamExplanation.mockImplementation(
      async ({ onText }: { onText: (t: string) => void }) => {
        onText(
          "## Short answer\nSix months, as held in Wombat v Numbat [S1]. Your notes say twelve months, citing Echidna v Platypus [S2].\n",
        );
        return { ok: true, model: "m", tokensIn: 1, tokensOut: 1, costUsd: 0 };
      },
    );
    const hits = [
      {
        passageId: "lib1",
        itemId: "i1",
        itemTitle: "Quokka notes",
        heading: null,
        text: libraryRow.text,
        pageFrom: 3,
        pageTo: 3,
        score: 1,
        meaningRank: 1,
        wordsRank: 1,
        origin: "library" as const,
      },
      {
        passageId: "up1",
        itemId: "u1",
        itemTitle: "My class notes.pdf",
        heading: null,
        text: uploadRow.text,
        pageFrom: 1,
        pageTo: 1,
        score: 1,
        meaningRank: 1,
        wordsRank: 1,
        origin: "upload" as const,
      },
    ];
    const composed = await composeAnswer({
      db: {} as never,
      hits,
      question: "q",
      level: "exam",
      history: [],
      courseId: null,
      userId: "u",
      onText: () => {},
    });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    expect(composed.shown).toContain("Wombat v Numbat [S1]");
    expect(composed.shown).not.toContain("Echidna v Platypus");
    expect(composed.removedAuthorities).toBe(1);
    expect(composed.used.map((h) => [h.label, h.origin])).toEqual([
      [1, "library"],
      [2, "upload"],
    ]);
    const sentToClaude = streamExplanation.mock.calls[0][0].turns.at(-1)
      .text as string;
    expect(sentToClaude).toContain('origin="student upload"');
  });
});
