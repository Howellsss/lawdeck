import { afterEach, describe, expect, it, vi } from "vitest";
import { rerankTexts } from "@/server/retrieval/rerank";

describe("Voyage re-ranker", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does nothing without a key", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await rerankTexts("q", ["a"], "rerank-2.5", "test")).toEqual({ ok: false, reason: "no_key" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the documents best first", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { index: 0, relevance_score: 0.2 },
            { index: 1, relevance_score: 0.9 },
            { index: 2, relevance_score: 0.5 },
          ],
          usage: { total_tokens: 30 },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);
    expect(await rerankTexts("q", ["a", "b", "c"], "rerank-2.5", "test")).toEqual({ ok: true, order: [1, 2, 0] });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).toMatchObject({ query: "q", documents: ["a", "b", "c"], model: "rerank-2.5" });
  });

  it("says busy when Voyage asks to slow down, and refuses a bad key", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "7" } })));
    expect(await rerankTexts("q", ["a"], "rerank-2.5", "test")).toEqual({ ok: false, reason: "busy", retryAfterMs: 7000 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    expect(await rerankTexts("q", ["a"], "rerank-2.5", "test")).toEqual({ ok: false, reason: "refused" });
  });

  it("rejects a reply that does not cover every document", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ index: 0, relevance_score: 1 }] }))));
    expect(await rerankTexts("q", ["a", "b"], "rerank-2.5", "test")).toEqual({ ok: false, reason: "unavailable" });
  });
});
