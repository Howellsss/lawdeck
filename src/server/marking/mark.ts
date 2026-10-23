import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { limitReachedMessage } from "@/lib/allowance";
import { pagesLabel } from "@/lib/pages";
import type { MarkingFeedback } from "@/schemas/marking";
import { parseCriteria } from "@/schemas/rubrics";
import { markWithClaude } from "@/server/ai/mark";
import { recordUsage } from "@/server/ai/usage";
import type { Database } from "@/server/db/types";
import { ALLOWANCE_UNAVAILABLE, getAllowance, hasQuestionsLeft } from "@/server/learn/allowance";
import { checkWithLibrary, citedLabels } from "@/server/learn/answerFilter";
import { filterContextFor } from "@/server/learn/filterContext";
import { redactPersonalData } from "@/server/learn/redact";
import { searchLibrary } from "@/server/retrieval/search";
import { combineMarks, percentScore } from "./combine";

type Db = SupabaseClient<Database>;

export type MarkAnswerResult = { ok: true; setId: string } | { ok: false; message: string };

export const NOT_COVERED_RULE = "The Lawdeck library does not cover the rule for this question yet.";

const FAILURES = {
  no_key: "Marking is not switched on yet: the Claude key is missing on the server.",
  busy: "Lawdeck is busy right now. Please try again in a minute.",
  refused: "Lawdeck can’t mark this answer. Please check it and try again.",
  unavailable: "Lawdeck could not reach the marking service. Please try again in a minute. Your answer has not been lost.",
  malformed: "Lawdeck could not mark the answer this time. Please try again.",
} as const;

// Marks a student's typed answer against an approved guide (PRD LN-08) and saves it in their
// Practice: the question, their answer, the marks for each point, what was good and missing, and
// the correct rule from the library. Counts as one question once saved; failures are free.
export async function markAnswer(db: Db, userId: string, input: { rubricId: string; answer: string }): Promise<MarkAnswerResult> {
  // Rule K-01: the monthly limit is checked before anything else costs money.
  const allowance = await getAllowance(db);
  if (!allowance) return { ok: false, message: ALLOWANCE_UNAVAILABLE };
  if (!hasQuestionsLeft(allowance)) return { ok: false, message: limitReachedMessage(allowance) };

  // Only approved guides are ever used (the database returns nothing for any other).
  const guide = await db.rpc("marking_guide", { rubric: input.rubricId });
  const row = guide.data?.[0];
  const criteria = parseCriteria(row?.criteria);
  if (guide.error || !row || criteria.length === 0) return { ok: false, message: "That question is not available for marking." };

  // The correct rule comes from the library; marking still works if the search finds nothing.
  const found = await searchLibrary({ question: row.question, courseId: row.course_id, includePending: false });
  const hits = (found.ok ? found.hits : []).map((hit, index) => ({ ...hit, label: index + 1 }));

  const marked = await markWithClaude({
    passages: hits.map((hit) => ({ label: hit.label, itemTitle: hit.itemTitle, heading: hit.heading, pages: pagesLabel(hit.pageFrom, hit.pageTo), text: hit.text })),
    question: row.question,
    criteria,
    // Rule G-06: email addresses and phone numbers never leave Lawdeck.
    answer: redactPersonalData(input.answer),
    userId,
  });
  if (!marked.ok) return { ok: false, message: FAILURES[marked.reason] };

  const context = await filterContextFor(db, hits, row.course_id);
  const rule = (await checkWithLibrary(marked.reply.correctRule, context)).trim() || NOT_COVERED_RULE;
  const sources = citedLabels(rule)
    .map((label) => hits.find((hit) => hit.label === label))
    .filter((hit) => hit !== undefined)
    .map((hit) => ({ label: hit.label, title: hit.itemTitle.slice(0, 300), heading: hit.heading?.slice(0, 500) ?? null, pages: pagesLabel(hit.pageFrom, hit.pageTo) }));
  const feedback: MarkingFeedback = { ...combineMarks(criteria, marked.reply), correctRule: rule, overall: marked.reply.overall, sources };

  const set = await db
    .from("practice_sets")
    .insert({ course_id: row.course_id, topic_id: row.topic_id, kind: "scenario", title: `Marked: ${row.title}`.slice(0, 200), model: marked.model })
    .select("id")
    .single();
  if (set.error) return saveFailed("set", set.error.code);
  const item = await db
    .from("practice_items")
    .insert({ set_id: set.data.id, position: 0, question: row.question, answer: rule, sources })
    .select("id")
    .single();
  if (item.error) {
    await db.from("practice_sets").delete().eq("id", set.data.id);
    return saveFailed("item", item.error.code);
  }
  const attempt = await db.from("attempts").insert({
    item_id: item.data.id,
    rubric_id: row.id,
    answer_text: input.answer,
    score: percentScore(feedback.total, feedback.max),
    feedback,
    model: marked.model,
  });
  if (attempt.error) {
    await db.from("practice_sets").delete().eq("id", set.data.id);
    return saveFailed("attempt", attempt.error.code);
  }
  // A marked answer counts as one question this month (founder's decision); failures are free.
  await recordUsage({ kind: "marking", model: marked.model, costUsd: marked.costUsd, ...marked.usage });
  return { ok: true, setId: set.data.id };
}

function saveFailed(step: string, code: string): MarkAnswerResult {
  console.error("marking failed", { step, code });
  return { ok: false, message: "Your marked answer was not saved. Please try again." };
}
