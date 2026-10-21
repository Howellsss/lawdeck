import "server-only";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { embedTexts, toVectorText } from "./voyage";
import { EMBEDDING_MODEL, SEARCH_RESULTS } from "./settings";

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
  | { ok: true; hits: SearchHit[]; meaningUsed: boolean }
  | { ok: false; message: string };

// Searches one course's library through search_library, as the signed-in person: the database
// applies course and approval filters before ranking. If Voyage cannot be reached, the search
// still runs on exact words and says so.
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
    match_count: SEARCH_RESULTS,
    include_pending: input.includePending,
  });
  if (error) {
    console.error("library search failed", { code: error.code });
    return { ok: false, message: "The search did not work. Please try again." };
  }
  return {
    ok: true,
    meaningUsed: vector !== null,
    hits: data.map((row) => ({
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
