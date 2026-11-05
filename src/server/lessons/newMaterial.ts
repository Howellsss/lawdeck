import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/types";
import { wordSearchText } from "@/server/retrieval/search";
import { EMBEDDING_MODEL } from "@/server/retrieval/settings";
import { embedTexts, toVectorText } from "@/server/retrieval/voyage";

type Db = SupabaseClient<Database>;

// How deep in a topic's search the new item must appear to count as "about" the topic: the same
// depth the lesson writer reads from for the topic itself (TOPIC_RESULTS in generate.ts).
const TOPIC_DEPTH = 14;

// After a library item is approved (docs/specs/remembrance.md): which topics' lessons it is about,
// found with the same search lessons are written from (no re-ranking, so it is quick and cheap).
// Those lessons are marked "new library material", so a reviewer can update just them. Runs as the
// reviewer who approved the item, after the page has answered. Never rewrites anything itself:
// each rewrite costs money and needs review.
export async function markLessonsWithNewMaterial(db: Db, itemId: string): Promise<number> {
  const item = await db.from("kb_items").select("course_id").eq("id", itemId).maybeSingle();
  if (item.error || !item.data) return 0;
  const lessons = await db.from("topic_lessons").select("topic_id").is("replaced_by", null);
  if (lessons.error) return 0;
  const topicIds = [...new Set(lessons.data.map((l) => l.topic_id))];
  if (topicIds.length === 0) return 0;
  let topicsQuery = db.from("topics").select("id, name, course_id").in("id", topicIds);
  if (item.data.course_id) topicsQuery = topicsQuery.eq("course_id", item.data.course_id);
  const topics = await topicsQuery;
  if (topics.error || topics.data.length === 0) return 0;

  // One request for every topic's meaning; if it fails, the word search still works.
  const embedded = await embedTexts(
    topics.data.map((t) => t.name),
    "query",
    EMBEDDING_MODEL,
    "new_material",
  );
  const marked: string[] = [];
  for (const [i, topic] of topics.data.entries()) {
    const vector = embedded.ok && embedded.vectors[i] ? toVectorText(embedded.vectors[i]) : null;
    const { data, error } = await db.rpc("search_library", {
      query_text: wordSearchText(topic.name),
      course: topic.course_id,
      query_embedding: vector,
      model: vector ? EMBEDDING_MODEL : null,
      match_count: TOPIC_DEPTH,
      include_pending: false,
    });
    if (error) {
      console.error("new material check failed", { code: error.code });
      continue;
    }
    if (data.some((row) => row.item_id === itemId)) marked.push(topic.id);
  }
  if (marked.length === 0) return 0;
  const { error } = await db.from("topic_lessons").update({ new_material_at: new Date().toISOString() }).in("topic_id", marked).is("replaced_by", null);
  if (error) {
    console.error("new material mark failed", { code: error.code });
    return 0;
  }
  console.info("new material marked", { lessons: marked.length });
  return marked.length;
}
