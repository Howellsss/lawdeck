import { afterEach, describe, expect, it, vi } from "vitest";
import { librarySearchSchema } from "@/schemas/library";
import { fuseRankings, rankByMeaning } from "@/server/retrieval/fuse";
import { passageSearchText } from "@/server/retrieval/indexJob";
import { embedTexts, toVectorText } from "@/server/retrieval/voyage";

const vector = (hot: number) => Array.from({ length: 1024 }, (_, i) => (i === hot ? 1 : 0));

describe("combining the two rankings", () => {
  it("puts a passage found both ways first", () => {
    expect(fuseRankings(["a", "b", "c"], ["c", "d"], 3)[0]).toBe("c");
  });

  it("keeps passages found only one way, and respects the limit", () => {
    expect(fuseRankings(["a", "b"], ["x"], 10).sort()).toEqual(["a", "b", "x"]);
    expect(fuseRankings(["a", "b", "c", "d"], [], 2)).toEqual(["a", "b"]);
  });

  it("only counts each ranking's top 40, like the database", () => {
    const deep = Array.from({ length: 50 }, (_, i) => `m${i}`);
    expect(fuseRankings(deep, [], 50)).toHaveLength(40);
  });
});

describe("ranking by meaning", () => {
  it("orders passages by how close their vectors are", () => {
    const passages = [
      { id: "far", vector: vector(5) },
      { id: "near", vector: vector(1).map((x, i) => (i === 2 ? 0.2 : x)) },
    ];
    expect(rankByMeaning(vector(1), passages)).toEqual(["near", "far"]);
  });
});

describe("the text a passage is searched by", () => {
  it("is its heading and then its wording", () => {
    expect(passageSearchText("Topic", "Body")).toBe("Topic\n\nBody");
    expect(passageSearchText(null, "Body")).toBe("Body");
  });
});

describe("Voyage AI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("says when the key is missing, without calling out", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await embedTexts(["a"], "query", "voyage-4", "test")).toEqual({ ok: false, reason: "no_key" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns vectors in the order of the texts and asks for 1024 numbers", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { index: 1, embedding: vector(2) },
            { index: 0, embedding: vector(1) },
          ],
          usage: { total_tokens: 10 },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const result = await embedTexts(["first", "second"], "document", "voyage-4", "test");
    expect(result).toEqual({ ok: true, vectors: [vector(1), vector(2)] });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: "voyage-4", input_type: "document", output_dimension: 1024 });
  });

  it("does not send a size to the legal model, which has a fixed size", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ index: 0, embedding: vector(0) }] })));
    vi.stubGlobal("fetch", fetchSpy);
    await embedTexts(["a"], "query", "voyage-law-2", "test");
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).output_dimension).toBeUndefined();
  });

  it("reports busy, refused and unusable replies plainly", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    expect(await embedTexts(["a"], "query", "voyage-4", "test")).toEqual({ ok: false, reason: "busy" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    expect(await embedTexts(["a"], "query", "voyage-4", "test")).toEqual({ ok: false, reason: "refused" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 2] }] }))));
    expect(await embedTexts(["a"], "query", "voyage-4", "test")).toEqual({ ok: false, reason: "unavailable" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await embedTexts(["a"], "query", "voyage-4", "test")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("writes vectors in the form the database accepts", () => {
    expect(toVectorText([0.5, -1, 0])).toBe("[0.5,-1,0]");
  });
});

describe("test search input", () => {
  const valid = { question: "  How is   a claim started? ", courseId: "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a", includePending: true };

  it("tidies the question", () => {
    expect(librarySearchSchema.parse(valid).question).toBe("How is a claim started?");
  });

  it("refuses empty or overlong questions and unknown courses", () => {
    expect(librarySearchSchema.safeParse({ ...valid, question: " " }).success).toBe(false);
    expect(librarySearchSchema.safeParse({ ...valid, question: "a".repeat(1001) }).success).toBe(false);
    expect(librarySearchSchema.safeParse({ ...valid, courseId: "civil" }).success).toBe(false);
  });
});
