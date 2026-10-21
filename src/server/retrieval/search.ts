import "server-only";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { passageSearchText } from "./indexJob";
import { rerankTexts } from "./rerank";
import { embedTexts, toVectorText } from "./voyage";
import { EMBEDDING_MODEL, RERANK_MODEL, RERANK_TIMEOUT_MS, SEARCH_CANDIDATES, SEARCH_RESULTS } from "./settings";

export type SearchHit = {
  passageId: string;
  itemId: string;
  itemTitle: string;
  heading: string | null;
  text: string;
  pageFrom: number | null;
  pageTo: number | null;
  score: number;
  meaningRank: number | null;
  wordsRank: number | null;
};

export type SearchResult =
  | { ok: true; hits: SearchHit[]; meaningUsed: boolean; reranked: boolean }
  | { ok: false; message: string };

// Searches one course's library through search_library, as the signed-in person: the database
// applies course and approval filters (and the student search limit) before ranking. It returns
// the top 30 candidates; Voyage's re-ranker then picks the best 8. If Voyage cannot be reached,
// the search still works (exact words, or the combined order without re-ranking) and says so.
export async function searchLibrary(input: {
  question: string;
  courseId: string;
  includePending: boolean;
}): Promise<SearchResult> {
  const embedded = await embedTexts([input.question], "query", EMBEDDING_MODEL, "search");
  const vector = embedded.ok ? embedded.vectors[0] : null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_library", {
    query_text: input.question,
    course: input.courseId,
    query_embedding: vector ? toVectorText(vector) : null,
    model: vector ? EMBEDDING_MODEL : null,
    match_count: SEARCH_CANDIDATES,
    include_pending: input.includePending,
  });
  if (error) {
    console.error("library search failed", { code: error.code });
    if (error.code === "LD429") {
      return { ok: false, message: "You have reached the search limit for now. Please try again in an hour." };
    }
    return { ok: false, message: "The search did not work. Please try again." };
  }
  // Library text is content, never instructions: the re-ranker only scores it.
  const reranked =
    data.length > 1
      ? await rerankTexts(
          input.question,
          data.map((row) => passageSearchText(row.heading, row.text)),
          RERANK_MODEL,
          "search",
          RERANK_TIMEOUT_MS,
        )
      : null;
  const ordered = reranked?.ok ? reranked.order.map((index) => data[index]) : data;
  return {
    ok: true,
    meaningUsed: vector !== null,
    reranked: reranked?.ok ?? false,
    hits: ordered.slice(0, SEARCH_RESULTS).map((row) => ({
      passageId: row.passage_id,
      itemId: row.item_id,
      itemTitle: row.item_title,
      heading: row.heading,
      text: row.text,
      pageFrom: row.page_from,
      pageTo: row.page_to,
      score: row.score,
      meaningRank: row.meaning_rank,
      wordsRank: row.words_rank,
    })),
  };
}
