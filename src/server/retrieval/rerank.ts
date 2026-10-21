import "server-only";
import { z } from "zod";
import { RERANK_MODELS, type RerankModel } from "./settings";

// Voyage AI's re-ranker reads the question next to each candidate passage and scores how well
// the passage answers it. Called directly over HTTPS (same account and key as the search
// vectors), so no extra library is needed. Server only.
const ENDPOINT = "https://api.voyageai.com/v1/rerank";
// Rule G-10: no call waits longer than 60 seconds (the live search waits much less).
const MAX_TIMEOUT_MS = 60_000;

const responseSchema = z.object({
  data: z.array(z.object({ index: z.number().int(), relevance_score: z.number() })),
  usage: z.object({ total_tokens: z.number().int() }).optional(),
});

export type RerankResult =
  | { ok: true; order: number[] }
  | { ok: false; reason: "no_key" | "busy" | "refused" | "unavailable"; retryAfterMs?: number };

// Returns the documents' positions, best first. Library text is content, never instructions:
// it is only scored here, not followed.
export async function rerankTexts(
  query: string,
  documents: string[],
  model: RerankModel,
  job: string,
  timeoutMs = MAX_TIMEOUT_MS,
): Promise<RerankResult> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };
  if (documents.length === 0) return { ok: true, order: [] };

  const started = Date.now();
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, documents, model, truncation: true }),
      signal: AbortSignal.timeout(Math.min(timeoutMs, MAX_TIMEOUT_MS)),
    });
    if (!response.ok) {
      console.error("rerank call failed", { job, model, status: response.status, ms: Date.now() - started });
      if (response.status === 429 || response.status >= 500) {
        const seconds = Number(response.headers.get("retry-after"));
        const retryAfterMs = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) * 1000 : 20_000;
        return { ok: false, reason: "busy", retryAfterMs };
      }
      return { ok: false, reason: "refused" };
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.data.length !== documents.length) {
      console.error("rerank call failed", { job, model, status: "bad_reply", ms: Date.now() - started });
      return { ok: false, reason: "unavailable" };
    }
    const tokens = parsed.data.usage?.total_tokens ?? 0;
    // Rule G-08: model, tokens, cost and time per call. Never the text.
    console.info("rerank call", {
      job,
      model,
      documents: documents.length,
      tokens,
      costUsd: Math.round(((tokens * RERANK_MODELS[model].pricePerMillion) / 1_000_000) * 1_000_000) / 1_000_000,
      ms: Date.now() - started,
    });
    return { ok: true, order: [...parsed.data.data].sort((a, b) => b.relevance_score - a.relevance_score).map((row) => row.index) };
  } catch (error) {
    console.error("rerank call failed", { job, model, name: (error as Error)?.name, ms: Date.now() - started });
    return { ok: false, reason: "unavailable" };
  }
}
