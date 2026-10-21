// The exact-words search uses Postgres websearch_to_tsquery, which needs every word to match.
// Joining the question's words with "or" lets a passage match on most of them instead; the
// database's ranking (ts_rank_cd) still puts passages with more of the words first.
// Postgres drops common words ("the", "of") itself.
const RESERVED = new Set(["or", "and", "not"]);

export function anyWordsQuery(question: string): string {
  const words = question.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.filter((word) => !RESERVED.has(word.toLowerCase())).join(" or ");
}
