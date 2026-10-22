import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { limitReachedMessage } from "@/lib/allowance";
import { pagesLabel } from "@/lib/pages";
import type { ExplainPassage } from "@/prompts/explain";
import { KIND_LABELS } from "@/prompts/practice";
import type { NewPracticeSet } from "@/schemas/practice";
import { makePracticeQuestions } from "@/server/ai/practice";
import { recordUsage } from "@/server/ai/usage";
import type { Database } from "@/server/db/types";
import { ALLOWANCE_UNAVAILABLE, getAllowance, hasQuestionsLeft } from "@/server/learn/allowance";
import { searchUnsure } from "@/server/learn/ask";
import { filterContextFor } from "@/server/learn/filterContext";
import { searchLibrary, type SearchHit } from "@/server/retrieval/search";
import { cleanPracticeItems, type CleanItem } from "./clean";

type Db = SupabaseClient<Database>;

export type CreatePracticeResult = { ok: true; id: string; dropped: number } | { ok: false; message: string };

export const NOT_ENOUGH_FOR_PRACTICE =
  "The library doesn’t have enough approved material on this topic to make good questions yet. Try another topic, or ask Lawdeck to explain it instead.";

const FAILURES = {
  no_key: "Practice is not switched on yet: the Claude key is missing on the server.",
  busy: "Lawdeck is busy right now. Please try again in a minute.",
  refused: "Lawdeck can’t make questions on this topic. Try another topic.",
  unavailable: "Lawdeck could not reach the question service. Please try again in a minute.",
  malformed: "Lawdeck could not make the questions this time. Please try again.",
} as const;

// Makes a practice set for the signed-in student (PRD LN-06): searches the approved library for
// the topic, asks Claude for questions from those passages only, keeps only questions that cite
// them and pass the citation check, and saves the set. Row-level security keeps it theirs.
export async function createPracticeSet(db: Db, userId: string, input: NewPracticeSet): Promise<CreatePracticeResult> {
  const topic = await db.from("topics").select("id, name, course_id").eq("id", input.topicId).maybeSingle();
  if (topic.error || !topic.data) return { ok: false, message: "That topic could not be found." };

  // Rule K-01: the monthly limit is checked before any AI is called.
  const allowance = await getAllowance(db);
  if (!allowance) return { ok: false, message: ALLOWANCE_UNAVAILABLE };
  if (!hasQuestionsLeft(allowance)) return { ok: false, message: limitReachedMessage(allowance) };

  const found = await searchLibrary({ question: topic.data.name, courseId: topic.data.course_id, includePending: false });
  if (!found.ok) return { ok: false, message: found.message };
  const unsure = searchUnsure(found);
  if (unsure) return { ok: false, message: unsure };
  if (found.hits.length === 0) return { ok: false, message: NOT_ENOUGH_FOR_PRACTICE };

  const hits = found.hits.map((hit, index) => ({ ...hit, label: index + 1 }));
  const made = await makePracticeQuestions({
    passages: hits.map(toPassage),
    topic: topic.data.name,
    kind: input.kind,
    count: input.count,
    userId,
  });
  if (!made.ok) return { ok: false, message: FAILURES[made.reason] };

  const context = await filterContextFor(db, hits, topic.data.course_id);
  const { items, dropped } = await cleanPracticeItems(made.reply, input.kind, input.count, context);
  if (items.length === 0) return { ok: false, message: NOT_ENOUGH_FOR_PRACTICE };

  const set = await db
    .from("practice_sets")
    .insert({
      course_id: topic.data.course_id,
      topic_id: topic.data.id,
      kind: input.kind,
      title: `${topic.data.name} · ${items.length} ${KIND_LABELS[input.kind]}`.slice(0, 200),
      model: made.model,
    })
    .select("id")
    .single();
  if (set.error) {
    console.error("practice failed", { step: "set", code: set.error.code });
    return { ok: false, message: "The practice set was not saved. Please try again." };
  }
  const saved = await db.from("practice_items").insert(items.map((item, position) => toRow(set.data.id, position, item, hits)));
  if (saved.error) {
    console.error("practice failed", { step: "items", code: saved.error.code });
    await db.from("practice_sets").delete().eq("id", set.data.id);
    return { ok: false, message: "The practice set was not saved. Please try again." };
  }
  // A saved set counts as one question this month (founder's decision); failed ones are free.
  await recordUsage({ kind: "practice", model: made.model, costUsd: made.costUsd, ...made.usage });
  if (dropped > 0) console.info("practice items dropped", { dropped, kept: items.length });
  return { ok: true, id: set.data.id, dropped };
}

function toPassage(hit: SearchHit & { label: number }): ExplainPassage {
  return { label: hit.label, itemTitle: hit.itemTitle, heading: hit.heading, pages: pagesLabel(hit.pageFrom, hit.pageTo), text: hit.text };
}

// Sources keep the title, heading, pages and passage id, never the passage text.
function toRow(setId: string, position: number, item: CleanItem, hits: (SearchHit & { label: number })[]) {
  const sources = item.sources
    .map((label) => hits.find((hit) => hit.label === label))
    .filter((hit) => hit !== undefined)
    .map((hit) => ({
      label: hit.label,
      passageId: hit.passageId,
      title: hit.itemTitle.slice(0, 300),
      heading: hit.heading?.slice(0, 500) ?? null,
      pages: pagesLabel(hit.pageFrom, hit.pageTo),
    }));
  return {
    set_id: setId,
    position,
    question: item.question,
    choices: item.choices,
    correct_choice: item.correctChoice,
    answer: item.answer,
    sources,
  };
}
