import { FUSION_DEPTH, FUSION_K } from "./settings";

// Reciprocal rank fusion: the same way search_library (migration 7) combines the ranking by
// meaning with the ranking by exact words. Used by the retrieval test to try models side by side.
export function fuseRankings(byMeaning: string[], byWords: string[], limit: number): string[] {
  const scores = new Map<string, number>();
  const add = (ids: string[]) =>
    ids.slice(0, FUSION_DEPTH).forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (FUSION_K + index + 1)));
  add(byMeaning);
  add(byWords);
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([id]) => id);
}

// Ids ranked by closeness of meaning (cosine similarity), closest first.
export function rankByMeaning(query: number[], passages: { id: string; vector: number[] }[]): string[] {
  const norm = (v: number[]) => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0)) || 1;
  const q = norm(query);
  return passages
    .map((p) => ({ id: p.id, score: p.vector.reduce((sum, x, i) => sum + x * query[i], 0) / (norm(p.vector) * q) }))
    .sort((a, b) => b.score - a.score)
    .map((p) => p.id);
}
