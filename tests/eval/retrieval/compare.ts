// ADMIN JOB helper for the retrieval test: the live search pipeline, with and without the
// re-ranker. Uses the Voyage key. Prints places and counts only, never library text.
import { fuseRankings } from "@/server/retrieval/fuse";
import { rerankTexts } from "@/server/retrieval/rerank";
import { RERANK_MODEL, RERANK_MODELS, SEARCH_CANDIDATES, type RerankModel } from "@/server/retrieval/settings";

export type Counts = { top: number; ai: number; exactAi: number; misses: string[] };

// Re-orders the candidates, waiting and retrying when Voyage asks us to slow down.
async function rerank(query: string, ids: string[], textOf: (id: string) => string, model: RerankModel) {
  for (let attempt = 0; ; attempt++) {
    const result = await rerankTexts(query, ids.map(textOf), model, "eval");
    if (result.ok) return result.order.map((index) => ids[index]);
    if (result.reason !== "busy" || attempt >= 10) throw new Error(`Voyage re-ranker (${model}) failed: ${result.reason}`);
    await new Promise((resolve) => setTimeout(resolve, result.retryAfterMs ?? 20_000));
  }
}

type Question = { id: number | string; question: string; kind?: "meaning" | "exact" };

// The live search: the database's top 30 (combined ranking), then the re-ranker picks the order.
// With reranker null, the combined order is kept (what students get if Voyage cannot be reached).
export async function scorePipeline(input: {
  questions: Question[];
  meaningOf: (index: number) => string[];
  wordsOf: (q: Question) => string[];
  textOf: (id: string) => string;
  isHit: (q: Question, ids: string[]) => boolean;
  placeOf: (q: Question, ids: string[]) => string;
  top: number;
  ai: number;
  reranker: RerankModel | null;
}): Promise<Counts> {
  const counts: Counts = { top: 0, ai: 0, exactAi: 0, misses: [] };
  for (const [i, q] of input.questions.entries()) {
    const candidates = fuseRankings(input.meaningOf(i), input.wordsOf(q), SEARCH_CANDIDATES);
    const ranked = input.reranker ? await rerank(q.question, candidates, input.textOf, input.reranker) : candidates;
    const inAi = input.isHit(q, ranked.slice(0, input.ai));
    counts.top += Number(input.isHit(q, ranked.slice(0, input.top)));
    counts.ai += Number(inAi);
    if (q.kind === "exact") counts.exactAi += Number(inAi);
    if (!inAi) counts.misses.push(`Q${q.id} at #${input.placeOf(q, ranked)}`);
  }
  return counts;
}

export function describe(label: string, counts: Counts, total: number, exactTotal: number, top: number, ai: number) {
  return `  ${label}: top ${top} ${counts.top}/${total}, top ${ai} ${counts.ai}/${total}; exact-term top ${ai} ${counts.exactAi}/${exactTotal}; not in top ${ai}: ${counts.misses.join(", ") || "none"}`;
}

export const LIVE_RERANKER = { model: RERANK_MODEL, label: RERANK_MODELS[RERANK_MODEL].label };
