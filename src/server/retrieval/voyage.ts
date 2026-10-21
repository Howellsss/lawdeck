import "server-only";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODELS, type EmbeddingModel } from "./settings";

// Voyage AI turns text into search vectors (System Design §2). Called directly over HTTPS,
// so no extra library is needed. Server only: the key never reaches the browser.
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";
// Rule G-10: no call waits longer than 60 seconds.
const TIMEOUT_MS = 60_000;
// Voyage takes up to 1,000 texts per call, but a new account without a payment method may
// only use about 10,000 tokens a minute. Batches are kept small so each call fits that.
export const EMBED_BATCH = 32;
export const EMBED_BATCH_TOKENS = 6_000;
// How long to wait when Voyage says it is busy and gives no time of its own.
const BUSY_WAIT_MS = 20_000;

const responseSchema = z.object({
  data: z.array(z.object({ index: z.number().int(), embedding: z.array(z.number()).length(EMBEDDING_DIMENSIONS) })),
  usage: z.object({ total_tokens: z.number().int() }).optional(),
});

export type EmbedResult =
  | { ok: true; vectors: number[][] }
  | { ok: false; reason: "busy"; retryAfterMs: number }
  | { ok: false; reason: "no_key" | "refused" | "unavailable" };

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
      if (response.status === 429 || response.status >= 500) {
        const seconds = Number(response.headers.get("retry-after"));
        return { ok: false, reason: "busy", retryAfterMs: seconds > 0 ? Math.min(seconds * 1000, 60_000) : BUSY_WAIT_MS };
      }
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

// A rough token count (about 4 characters per token), enough to size batches.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Splits texts into batches of at most EMBED_BATCH texts and about EMBED_BATCH_TOKENS tokens.
// A single text larger than the limit gets a batch of its own.
export function batchByTokens(texts: string[], maxTokens = EMBED_BATCH_TOKENS, maxCount = EMBED_BATCH): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let tokens = 0;
  for (const text of texts) {
    const size = estimateTokens(text);
    if (current.length && (tokens + size > maxTokens || current.length >= maxCount)) {
      batches.push(current);
      current = [];
      tokens = 0;
    }
    current.push(text);
    tokens += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

// Like embedTexts, but when Voyage is busy it waits as asked and tries again, as long as the
// caller's deadline allows. Still "busy" if the deadline comes first.
export async function embedWithRetry(
  texts: string[],
  inputType: "document" | "query",
  model: EmbeddingModel,
  job: string,
  deadline: number,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<EmbedResult> {
  for (;;) {
    const result = await embedTexts(texts, inputType, model, job);
    if (result.ok || result.reason !== "busy") return result;
    if (Date.now() + result.retryAfterMs > deadline) return result;
    await wait(result.retryAfterMs);
  }
}
