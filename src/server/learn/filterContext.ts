import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/types";
import type { SearchHit } from "@/server/retrieval/search";
import type { FilterContext, LibraryLookup } from "./answerFilter";

type Db = SupabaseClient<Database>;

// Everything the citation check needs for one set of passages (rules G-04, G-05): the passage
// labels and text, which of them are statutes or rules of court, the recognised titles, and the
// whole-library lookup. Shared by explanations (step 3b) and practice questions (step 4b).
export async function filterContextFor(db: Db, hits: (SearchHit & { label: number })[], courseId: string | null): Promise<FilterContext> {
  const [types, recognised] = await Promise.all([itemTypes(db, hits), recognisedTitles(db, courseId)]);
  return {
    labels: new Set(hits.map((hit) => hit.label)),
    passageTexts: hits.map((hit) => `${hit.heading ?? ""} ${hit.text}`),
    statuteTexts: hits.filter((hit) => types.get(hit.itemId)).map((hit) => hit.text),
    recognisedTitles: recognised,
    lookup: libraryLookup(db, courseId),
  };
}

// Which items are statutes or rules of court (their quotations may be longer).
async function itemTypes(db: Db, hits: SearchHit[]): Promise<Map<string, boolean>> {
  const ids = [...new Set(hits.map((hit) => hit.itemId))];
  const { data } = await db.from("kb_items").select("id, type").in("id", ids);
  return new Map((data ?? []).map((item) => [item.id, item.type === "statute" || item.type === "rule_of_court"]));
}

// Approved statutes and rules of court in the library: the "recognised statutes".
async function recognisedTitles(db: Db, courseId: string | null): Promise<string[]> {
  let query = db.from("kb_items").select("title").in("type", ["statute", "rule_of_court"]).limit(500);
  if (courseId) query = query.eq("course_id", courseId);
  const { data } = await query;
  return (data ?? []).map((item) => item.title);
}

// Asks the whole approved library (in this course, or all courses) which names it mentions.
// Row-level rules apply as for search; only the names found come back, never library text.
function libraryLookup(db: Db, courseId: string | null): LibraryLookup {
  return async ({ statutes, cases }) => {
    const { data, error } = await db.rpc("library_mentions", { statutes, cases, course: courseId ?? undefined });
    if (error) {
      console.warn("citation check lookup failed", { code: error.code });
      return new Set();
    }
    return new Set(data.map((row) => row.phrase));
  };
}
