import "server-only";

// Search settings in one place (System Design §6). Changing any of these means re-running
// the retrieval test (tests/eval/retrieval) and recording the result in docs/specs/retrieval-eval.md.

// The two Voyage models compared in step 2d. Both make vectors of 1024 numbers, the size the
// database stores. Prices are US dollars per million tokens, from Voyage's price list; check
// them at voyageai.com/pricing before relying on the logged cost.
export const EMBEDDING_MODELS = {
  "voyage-4": { label: "General (voyage-4)", pricePerMillion: 0.06, setsDimension: true },
  "voyage-law-2": { label: "Legal (voyage-law-2)", pricePerMillion: 0.12, setsDimension: false },
} as const;

export type EmbeddingModel = keyof typeof EMBEDDING_MODELS;

// The model used for the library until the test picks one (2d).
export const EMBEDDING_MODEL: EmbeddingModel = "voyage-4";

export const EMBEDDING_DIMENSIONS = 1024;

// How many passages a search returns at most (the database also caps this at 8).
export const SEARCH_RESULTS = 8;

// Hybrid search: each ranking keeps its top 40, and they are combined by reciprocal rank
// fusion with k = 60. The same numbers are in search_library (migration 7).
export const FUSION_K = 60;
export const FUSION_DEPTH = 40;

// Re-rankers tried in the retrieval test (not used by the live search yet). US dollars per
// million tokens, from Voyage's price list; check voyageai.com/pricing before relying on it.
export const RERANK_MODELS = {
  "rerank-2.5": { label: "rerank-2.5", pricePerMillion: 0.05 },
  "rerank-2.5-lite": { label: "rerank-2.5-lite", pricePerMillion: 0.02 },
} as const;

export type RerankModel = keyof typeof RERANK_MODELS;

// How many combined results the re-ranker reads before picking the best.
export const RERANK_CANDIDATES = 30;
