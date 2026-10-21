import "server-only";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODELS, type EmbeddingModel } from "./settings";

// Voyage AI turns text into search vectors (System Design §2). Called directly over HTTPS,
// so no extra library is needed. Server only: the key never reaches the browser.
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";
// Rule G-10: no call waits longer than 60 seconds.
const TIMEOUT_MS = 60_000;
// Voyage takes up to 1,000 texts per call; batches stay well below its token limit too.
export const EMBED_BATCH = 32;

const responseSchema = z.object({
  data: z.array(z.object({ index: z.number().int(), embedding: z.array(z.number()).length(EMBEDDING_DIMENSIONS) })),
  usage: z.object({ total_tokens: z.number().int() }).optional(),
});

export type EmbedResult =
  | { ok: true; vectors: number[][] }
  | { ok: false; reason: "no_key" | "busy" | "refused" | "unavailable" };

// "document" for library passages, "query" for a question being searched.
export async function embedTexts(
  texts: string[],
  inputType: "document" | "query",
  model: EmbeddingModel,
  job: string,
): Promise<EmbedResult> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) return { ok: false, reason: "no_key" };
  if (texts.length === 0) return { ok: true, vectors: [] };

  const started = Date.now();
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: texts,
        model,
        input_type: inputType,
        truncation: true,
        ...(EMBEDDING_MODELS[model].setsDimension ? { output_dimension: EMBEDDING_DIMENSIONS } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("embedding call failed", { job, model, status: response.status, ms: Date.now() - started });
      if (response.status === 429 || response.status >= 500) return { ok: false, reason: "busy" };
      return { ok: false, reason: "refused" };
    }
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.data.length !== texts.length) {
      console.error("embedding call failed", { job, model, status: "bad_reply", ms: Date.now() - started });
      return { ok: false, reason: "unavailable" };
    }
    const tokens = parsed.data.usage?.total_tokens ?? 0;
    // Rule G-08: model, tokens, cost and time per call. Never the text.
    console.info("embedding call", {
      job,
      model,
      texts: texts.length,
      tokens,
      costUsd: Math.round(((tokens * EMBEDDING_MODELS[model].pricePerMillion) / 1_000_000) * 1_000_000) / 1_000_000,
      ms: Date.now() - started,
    });
    const vectors: number[][] = [];
    for (const row of parsed.data.data) vectors[row.index] = row.embedding;
    return { ok: true, vectors };
  } catch (error) {
    console.error("embedding call failed", { job, model, name: (error as Error)?.name, ms: Date.now() - started });
    return { ok: false, reason: "unavailable" };
  }
}

// The text form pgvector accepts, e.g. "[0.1,0.2]".
export function toVectorText(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
