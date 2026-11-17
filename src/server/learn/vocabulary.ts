import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVocabulary, type Vocabulary } from "@/lib/legalWords";
import type { Database } from "@/server/db/types";

// The words voice mode listens for (src/lib/legalWords.ts): the names of Lawdeck's courses,
// topics and reviewed library books. Read with the student's own access (row-level security
// applies), and kept for a few minutes so each spoken turn does not read them again.
const KEEP_MS = 10 * 60_000;
let kept: { at: number; vocabulary: Vocabulary } | null = null;

export async function voiceVocabulary(db: SupabaseClient<Database>, now = Date.now()): Promise<Vocabulary> {
  if (kept && now - kept.at < KEEP_MS) return kept.vocabulary;
  const [courses, topics, books] = await Promise.all([
    db.from("courses").select("name"),
    db.from("topics").select("name"),
    db.from("kb_items").select("title").eq("review_status", "approved").limit(2000),
  ]);
  const names = [
    ...(courses.data ?? []).map((row) => row.name),
    ...(topics.data ?? []).map((row) => row.name),
    ...(books.data ?? []).map((row) => row.title),
  ];
  const vocabulary = buildVocabulary(names);
  // A failed read is not kept, so the next turn tries again.
  if (!courses.error && !topics.error) kept = { at: now, vocabulary };
  return vocabulary;
}
