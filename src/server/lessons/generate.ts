import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pagesLabel } from "@/lib/pages";
import { LESSON_PROMPT_VERSION } from "@/prompts/lesson";
import { outlineTopic, writeLesson } from "@/server/ai/lesson";
import type { Database } from "@/server/db/types";
import { filterContextFor } from "@/server/learn/filterContext";
import { searchLibrary, type SearchHit } from "@/server/retrieval/search";
import { cleanLesson, lessonSources } from "./clean";

type Db = SupabaseClient<Database>;

export type GenerateLessonResult =
  | { ok: true; lessonId: string; sections: number; checkpoints: number; authorities: number; removed: number }
  | { ok: false; message: string };

// The most passages one lesson is written from (the topic's own search, then each subtopic's).
const MAX_PASSAGES = 40;
const TOPIC_RESULTS = 14;
const SUBTOPIC_RESULTS = 6;

const FAILURES = {
  no_key: "Lessons are not switched on yet: the Claude key is missing on the server.",
  no_credit: "Your Anthropic credit has run out, so Claude refused. Top up at console.anthropic.com (Settings → Billing), then try again.",
  busy: "Claude is busy right now. Please try again in a minute.",
  timeout: "Claude took longer than 4½ minutes on this lesson and was stopped. Please try again; writing fewer at once helps.",
  too_long: "The lesson came out too long and was cut off. Please try again.",
  refused: "Claude would not write this lesson. Check the topic's name and the library material.",
  unavailable: "Lawdeck could not reach Claude, or the lesson took too long. Please try again.",
  malformed: "The lesson came back incomplete. Please try again.",
} as const;

// Writes (or rewrites) a topic's lesson for review (docs/specs/remembrance.md, Phase 1a). Runs as
// the signed-in reviewer: the database only lets reviewers write lessons. The lesson is saved as
// "awaiting review"; students see it only once a reviewer approves it. Rewriting replaces its
// questions, so students' revision for that topic starts again.
export async function generateLesson(db: Db, topicId: string): Promise<GenerateLessonResult> {
  const topic = await db.from("topics").select("id, name, course_id").eq("id", topicId).maybeSingle();
  if (topic.error || !topic.data) return { ok: false, message: "That topic could not be found." };
  const course = await db.from("courses").select("id, name").eq("id", topic.data.course_id).maybeSingle();
  if (course.error || !course.data) return { ok: false, message: "That topic's course could not be found." };

  const topicName = topic.data.name;
  const courseId = course.data.id;
  const outline = await outlineTopic(course.data.name, topicName);
  const searches = await Promise.all([
    searchLibrary({ question: topic.data.name, courseId: course.data.id, includePending: false, results: TOPIC_RESULTS, db }),
    ...outline.map((phrase) =>
      searchLibrary({ question: `${topicName}: ${phrase}`, courseId, includePending: false, results: SUBTOPIC_RESULTS, db }),
    ),
  ]);
  if (!searches[0].ok) return { ok: false, message: searches[0].message };
  const merged: SearchHit[] = [];
  for (const result of searches) {
    if (!result.ok) continue;
    for (const hit of result.hits) {
      if (merged.length >= MAX_PASSAGES) break;
      if (!merged.some((m) => m.passageId === hit.passageId)) merged.push(hit);
    }
  }
  if (merged.length === 0) {
    return { ok: false, message: "The approved library has nothing on this topic yet. Add and approve material for it first." };
  }

  const hits = merged.map((hit, index) => ({ ...hit, label: index + 1, pages: pagesLabel(hit.pageFrom, hit.pageTo) }));
  const written = await writeLesson({
    passages: hits.map((hit) => ({ label: hit.label, itemTitle: hit.itemTitle, heading: hit.heading, pages: hit.pages, text: hit.text, sourceKind: hit.sourceKind })),
    course: course.data.name,
    topic: topic.data.name,
  });
  if (!written.ok) return { ok: false, message: FAILURES[written.reason] };
  if (!written.reply.found || written.reply.sections.length === 0) {
    return { ok: false, message: "The library's passages are not about this topic, so no lesson was written. Check the topic's name or the material." };
  }

  const clean = await cleanLesson(written.reply, await filterContextFor(db, hits, course.data.id));
  const content = { ...clean.content, sources: lessonSources(clean.usedLabels, hits) };
  const lessonFields = {
    title: clean.title || topic.data.name,
    content,
    model: written.model,
    prompt_version: LESSON_PROMPT_VERSION,
  };

  // One lesson per topic: rewrite it in place, or add it.
  const existing = await db.from("topic_lessons").select("id").eq("topic_id", topicId).maybeSingle();
  let lessonId: string;
  if (existing.data) {
    const updated = await db
      .from("topic_lessons")
      .update({ ...lessonFields, status: "pending", review_note: null })
      .eq("id", existing.data.id);
    if (updated.error) return saveFailed("update", updated.error.code);
    lessonId = existing.data.id;
    const [gone, goneAuthorities] = await Promise.all([
      db.from("lesson_checkpoints").delete().eq("lesson_id", lessonId),
      db.from("lesson_authorities").delete().eq("lesson_id", lessonId),
    ]);
    if (gone.error || goneAuthorities.error) return saveFailed("clear", gone.error?.code ?? goneAuthorities.error?.code);
  } else {
    const inserted = await db.from("topic_lessons").insert({ topic_id: topicId, ...lessonFields }).select("id").single();
    if (inserted.error) return saveFailed("insert", inserted.error.code);
    lessonId = inserted.data.id;
  }

  const [checkpoints, authorities] = await Promise.all([
    clean.checkpoints.length
      ? db.from("lesson_checkpoints").insert(clean.checkpoints.map((row) => ({ ...row, lesson_id: lessonId })))
      : null,
    clean.authorities.length
      ? db.from("lesson_authorities").insert(clean.authorities.map((row) => ({ ...row, lesson_id: lessonId })))
      : null,
  ]);
  if (checkpoints?.error || authorities?.error) return saveFailed("parts", checkpoints?.error?.code ?? authorities?.error?.code);

  return {
    ok: true,
    lessonId,
    sections: content.sections.length,
    checkpoints: clean.checkpoints.length,
    authorities: clean.authorities.length,
    removed: clean.removed,
  };
}

function saveFailed(step: string, code: string | undefined): GenerateLessonResult {
  console.error("lesson save failed", { step, code: code ?? "unknown" });
  return { ok: false, message: "The lesson was written but could not be saved. Please try again." };
}
