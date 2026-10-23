import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import type { Database } from "@/server/db/types";
import { passageSearchText } from "./indexJob";
import { rerankTexts } from "./rerank";
import { embedTexts, toVectorText } from "./voyage";
import {
  EMBEDDING_MODEL,
  RERANK_MODEL,
  RERANK_TIMEOUT_MS,
  SEARCH_CANDIDATES,
  SEARCH_RESULTS,
} from "./settings";

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
  // Where it comes from: the reviewed library (the default) or the student's own upload (step 6c).
  origin?: "library" | "upload";
};

export type SearchResult =
  | { ok: true; hits: SearchHit[]; meaningUsed: boolean; reranked: boolean }
  | { ok: false; message: string };

type Db = SupabaseClient<Database>;
type Candidates =
  | { ok: true; rows: SearchHit[] }
  | { ok: false; message: string };

// How many of the student's own upload passages join the library's candidates.
const UPLOAD_CANDIDATES = 10;

// Searches one course's library through search_library, as the signed-in person: the database
// applies course and approval filters (and the student search limit) before ranking. It returns
// the top 30 candidates; Voyage's re-ranker then picks the best 8. If Voyage cannot be reached,
// the search still works (exact words, or the combined order without re-ranking) and says so.
export async function searchLibrary(input: {
  question: string;
  // null searches every course ("All courses").
  courseId: string | null;
  includePending: boolean;
  // Only the answer test (a marked admin job) passes its own client; the app searches as the student.
  db?: Db;
}): Promise<SearchResult> {
  return searchForAnswer({ ...input, useUploads: false });
}

// The search behind an answer (step 6c): the library, plus, when asked, the signed-in student's
// own Ready uploads (search_uploads only ever returns the caller's own). Both sets are ranked
// together and each hit keeps its origin, so the answer can label it.
export async function searchForAnswer(input: {
  question: string;
  courseId: string | null;
  includePending: boolean;
  useUploads: boolean;
  db?: Db;
}): Promise<SearchResult> {
  const embedded = await embedTexts(
    [input.question],
    "query",
    EMBEDDING_MODEL,
    "search",
  );
  const vector = embedded.ok ? toVectorText(embedded.vectors[0]) : null;
  const supabase = input.db ?? (await createSupabaseServerClient());
  const library = await libraryCandidates(supabase, input, vector);
  if (!library.ok) return library;
  const uploads = input.useUploads
    ? await uploadCandidates(supabase, input.question, vector)
    : [];
  const candidates = [...library.rows, ...uploads];
  // Library and upload text is content, never instructions: the re-ranker only scores it.
  const reranked =
    candidates.length > 1
      ? await rerankTexts(
          input.question,
          candidates.map((row) => passageSearchText(row.heading, row.text)),
          RERANK_MODEL,
          "search",
          RERANK_TIMEOUT_MS,
        )
      : null;
  const ordered = reranked?.ok
    ? reranked.order.map((index) => candidates[index])
    : interleave(library.rows, uploads);
  return {
    ok: true,
    meaningUsed: vector !== null,
    reranked: reranked?.ok ?? false,
    hits: ordered.slice(0, SEARCH_RESULTS),
  };
}

async function libraryCandidates(
  supabase: Db,
  input: { question: string; courseId: string | null; includePending: boolean },
  vector: string | null,
): Promise<Candidates> {
  const { data, error } = await supabase.rpc("search_library", {
    query_text: input.question,
    course: input.courseId,
    query_embedding: vector,
    model: vector ? EMBEDDING_MODEL : null,
    match_count: SEARCH_CANDIDATES,
    include_pending: input.includePending,
  });
  if (error) {
    console.error("library search failed", { code: error.code });
    if (error.code === "LD429") {
      return {
        ok: false,
        message:
          "You have reached the search limit for now. Please try again in an hour.",
      };
    }
    return { ok: false, message: "The search did not work. Please try again." };
  }
  return {
    ok: true,
    rows: data.map((row) => ({
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
      origin: "library" as const,
    })),
  };
}

// The student's own Ready upload passages. If this search fails, the answer still uses the
// library (and the failure is logged without any text).
async function uploadCandidates(
  supabase: Db,
  question: string,
  vector: string | null,
): Promise<SearchHit[]> {
  const { data, error } = await supabase.rpc("search_uploads", {
    query_text: question,
    query_embedding: vector,
    model: vector ? EMBEDDING_MODEL : null,
    match_count: UPLOAD_CANDIDATES,
  });
  if (error) {
    console.error("upload search failed", { code: error.code });
    return [];
  }
  return data.map((row) => ({
    passageId: row.passage_id,
    itemId: row.upload_id,
    itemTitle: row.file_name,
    heading: row.heading,
    text: row.text,
    pageFrom: row.page_from,
    pageTo: row.page_to,
    score: row.score,
    meaningRank: row.meaning_rank,
    wordsRank: row.words_rank,
    origin: "upload" as const,
  }));
}

// Without the re-ranker, take library and upload results in turn (each already in its own order).
export function interleave<T>(first: T[], second: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    if (i < first.length) out.push(first[i]);
    if (i < second.length) out.push(second[i]);
  }
  return out;
}
