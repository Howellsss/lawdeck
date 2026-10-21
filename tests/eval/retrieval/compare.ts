// ADMIN JOB helper for the retrieval test: compares search setups on the same questions.
// Uses the Voyage key (re-ranker). Prints places and counts only, never library text.
import { fuseRankings } from "@/server/retrieval/fuse";
import { rerankTexts } from "@/server/retrieval/rerank";
import { RERANK_CANDIDATES, RERANK_MODELS, type RerankModel } from "@/server/retrieval/settings";

export type Setup = { label: string; words: "all" | "most"; reranker: RerankModel | null };

export const SETUPS: Setup[] = [
  { label: "live (all words)", words: "all", reranker: null },
  { label: "most words", words: "most", reranker: null },
  { label: "all words + rerank-2.5", words: "all", reranker: "rerank-2.5" },
  { label: "most words + rerank-2.5", words: "most", reranker: "rerank-2.5" },
  { label: "most words + rerank-2.5-lite", words: "most", reranker: "rerank-2.5-lite" },
];

// Re-orders the top candidates, waiting and retrying when Voyage asks us to slow down.
async function rerank(query: string, ids: string[], textOf: (id: string) => string, model: RerankModel) {
  for (let attempt = 0; ; attempt++) {
    const result = await rerankTexts(query, ids.map(textOf), model, "eval");
    if (result.ok) return result.order.map((index) => ids[index]);
    if (result.reason !== "busy" || attempt >= 10) throw new Error(`Voyage re-ranker (${model}) failed: ${result.reason}`);
    await new Promise((resolve) => setTimeout(resolve, result.retryAfterMs ?? 20_000));
  }
}

type Question = { id: number | string; question: string; kind?: "meaning" | "exact" };

// For each setup: hits in the top `top` and top `ai`, overall and for exact-term questions,
// and for the misses in the top `ai`, where the right passage ended up.
export async function compareSetups(input: {
  questions: Question[];
  meaningOf: (index: number) => string[];
  wordsOf: (q: Question, words: Setup["words"]) => string[];
  textOf: (id: string) => string;
  isHit: (q: Question, ids: string[]) => boolean;
  placeOf: (q: Question, ids: string[]) => string;
  top: number;
  ai: number;
}): Promise<string[]> {
  const { questions, top, ai } = input;
  const exactCount = questions.filter((q) => q.kind === "exact").length;
  const lines: string[] = [];
  for (const setup of SETUPS) {
    const counts = { top: 0, ai: 0, exactTop: 0, exactAi: 0 };
    const misses: string[] = [];
    for (const [i, q] of questions.entries()) {
      const fused = fuseRankings(input.meaningOf(i), input.wordsOf(q, setup.words), RERANK_CANDIDATES);
      const ranked = setup.reranker ? await rerank(q.question, fused, input.textOf, setup.reranker) : fused;
      const inTop = input.isHit(q, ranked.slice(0, top));
      const inAi = input.isHit(q, ranked.slice(0, ai));
      counts.top += Number(inTop);
      counts.ai += Number(inAi);
      if (q.kind === "exact") {
        counts.exactTop += Number(inTop);
        counts.exactAi += Number(inAi);
      }
      if (!inAi) misses.push(`Q${q.id} at #${input.placeOf(q, ranked)}`);
    }
    const name = setup.reranker ? `${setup.label} (${RERANK_MODELS[setup.reranker].label})` : setup.label;
    lines.push(
      `  ${name}: top ${top} ${counts.top}/${questions.length}, top ${ai} ${counts.ai}/${questions.length}; exact-term top ${ai} ${counts.exactAi}/${exactCount}; not in top ${ai}: ${misses.join(", ") || "none"}`,
    );
  }
  return lines;
}
