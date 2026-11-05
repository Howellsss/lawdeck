"use server";

import { keepsAllPoints, sameStory } from "@/lib/againRules";
import { limitReachedMessage } from "@/lib/allowance";
import { z } from "@/lib/zod";
import { AID_AGAIN_SYSTEM, aidAgainRequest, STORY_AGAIN_SYSTEM, storyAgainRequest } from "@/prompts/again";
import { AID_KINDS } from "@/schemas/extras";
import { lessonContentSchema } from "@/schemas/lesson";
import { writeAgain, type AgainResult } from "@/server/ai/again";
import { recordUsage } from "@/server/ai/usage";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { checkWithLibrary, REMOVED_AUTHORITY } from "@/server/learn/answerFilter";
import { ALLOWANCE_UNAVAILABLE, getAllowance, hasQuestionsLeft } from "@/server/learn/allowance";
import { libraryOnlyContext } from "@/server/learn/filterContext";

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Fail = { ok: false; message: string };
type Items = { key: string; meaning: string }[];
export type MadeAid = { kind: (typeof AID_KINDS)[number]; title: string; device: string; items: Items; explanation: string | null };
export type MadeStory = { kind: "everyday" | "case"; title: string; parts: { heading: string; text: string }[]; takeaway: string };

const FAILURES: Record<Exclude<AgainResult, { ok: true }>["reason"], string> = {
  no_key: "This is not switched on yet. Please try again later.",
  no_credit: "Lawdeck cannot make new memory aids right now. Please try again later.",
  busy: "Lawdeck is busy right now. Please try again in a minute.",
  timeout: "That took too long. Please try again.",
  refused: "Lawdeck could not make another version of this one.",
  unavailable: "Lawdeck could not be reached. Please try again.",
  malformed: "It came back incomplete. Please try again.",
};
const NOT_KEPT = "Lawdeck could not make a version that keeps every point and passes its checks. Your question was not used. Please try again.";

const pairs = (value: unknown): Items =>
  (Array.isArray(value) ? value : []).flatMap((v) => (typeof v?.key === "string" && typeof v?.meaning === "string" ? [{ key: v.key, meaning: v.meaning }] : []));

// The approved lesson a memory aid set belongs to, as reviewed text (students cannot read library
// passages; the lesson and its authority cards come from them and were reviewed).
async function lessonFor(db: Db, extrasId: string) {
  const set = await db.from("lesson_extras").select("lesson_id").eq("id", extrasId).maybeSingle();
  if (!set.data) return null;
  const lesson = await db.from("topic_lessons").select("id, topic_id, content").eq("id", set.data.lesson_id).maybeSingle();
  const content = lesson.data ? lessonContentSchema.safeParse(lesson.data.content) : null;
  if (!lesson.data || !content?.success) return null;
  const [topic, authorities] = await Promise.all([
    db.from("topics").select("name, course_id").eq("id", lesson.data.topic_id).single(),
    db.from("lesson_authorities").select("key, kind, name, citation, principle, facts_from_library, facts, issue, decision").eq("lesson_id", lesson.data.id),
  ]);
  if (topic.error) return null;
  return {
    topicId: lesson.data.topic_id,
    courseId: topic.data.course_id,
    lesson: {
      topic: topic.data.name,
      sections: content.data.sections.map((s) => ({ heading: s.heading, paragraphs: s.paragraphs.map((p) => p.text) })),
      authorities: (authorities.data ?? []).map((a) => ({
        key: a.key,
        kind: a.kind,
        name: a.name,
        citation: a.citation,
        principle: a.principle,
        factsFromLibrary: a.facts_from_library,
        facts: a.facts_from_library ? a.facts : null,
        issue: a.issue,
        decision: a.decision,
      })),
    },
  };
}

// Signed in, with a question left (each request counts as one: founder, 2026-11-05).
async function ready(): Promise<{ db: Db } | Fail> {
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to ask for another version." };
  const db = await createSupabaseServerClient();
  const allowance = await getAllowance(db);
  if (!allowance) return { ok: false, message: ALLOWANCE_UNAVAILABLE };
  if (!hasQuestionsLeft(allowance)) return { ok: false, message: limitReachedMessage(allowance) };
  return { db };
}

// Every piece of text through the citation check; null if it named an authority the library
// cannot confirm.
async function checked(db: Db, courseId: string, texts: string[]): Promise<string[] | null> {
  const context = await libraryOnlyContext(db, courseId);
  const out = await Promise.all(texts.map((t) => (t ? checkWithLibrary(t, context) : Promise.resolve(""))));
  return out.some((t) => t.includes(REMOVED_AUTHORITY)) ? null : out;
}

async function countIt(result: Extract<AgainResult, { ok: true }>) {
  await recordUsage({ kind: "memory_aid", model: result.model, tokensIn: result.tokensIn, tokensOut: result.tokensOut, costUsd: result.costUsd, ms: result.ms });
}

const aidSchema = z.object({ aidId: z.uuid({ error: "That memory aid could not be found." }) });

// "Another memory aid": the same points, a different device. Counts as one question when it works.
export async function anotherAid(input: { aidId: string }): Promise<{ ok: true; aid: MadeAid; topicId: string } | Fail> {
  const parsed = aidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That memory aid could not be found." };
  const start = await ready();
  if ("ok" in start) return start;
  const { db } = start;
  const aid = await db.from("lesson_memory_aids").select("extras_id, after_section, kind, title, device, items").eq("id", parsed.data.aidId).maybeSingle();
  const source = aid.data ? await lessonFor(db, aid.data.extras_id) : null;
  if (!aid.data || !source) return { ok: false, message: "That memory aid could not be found." };
  const original = { afterSection: aid.data.after_section, kind: aid.data.kind, title: aid.data.title, device: aid.data.device, items: pairs(aid.data.items) };

  const result = await writeAgain("aid", AID_AGAIN_SYSTEM, aidAgainRequest(source.lesson, original));
  if (!result.ok) return { ok: false, message: FAILURES[result.reason] };
  const made = result.reply.memory_aids[0];
  if (!result.reply.found || !made || !keepsAllPoints(original, made)) return { ok: false, message: NOT_KEPT };
  const texts = await checked(db, source.courseId, [made.device, made.explanation]);
  if (!texts) return { ok: false, message: NOT_KEPT };
  await countIt(result);
  const [device, explanation] = texts;
  // Each point keeps the reviewed wording of the original aid, whatever came back: only the
  // device and its keys are new, so a new aid can never change the law it summarises.
  return {
    ok: true,
    topicId: source.topicId,
    aid: {
      kind: made.kind,
      title: original.title,
      device: device || made.device,
      items: made.items.map((item, i) => ({ key: item.key, meaning: original.items[i]?.meaning ?? item.meaning })),
      explanation: explanation || null,
    },
  };
}

const storySchema = z.object({ storyId: z.uuid({ error: "That story could not be found." }) });

// "Tell it another way": the same point and takeaway, told differently. Counts as one question.
export async function anotherStory(input: { storyId: string }): Promise<{ ok: true; story: MadeStory } | Fail> {
  const parsed = storySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That story could not be found." };
  const start = await ready();
  if ("ok" in start) return start;
  const { db } = start;
  const story = await db.from("lesson_stories").select("extras_id, after_section, kind, title, authority_key, parts, takeaway").eq("id", parsed.data.storyId).maybeSingle();
  const source = story.data ? await lessonFor(db, story.data.extras_id) : null;
  if (!story.data || !source) return { ok: false, message: "That story could not be found." };
  const parts = (Array.isArray(story.data.parts) ? story.data.parts : []).flatMap((p) =>
    p && typeof p === "object" && !Array.isArray(p) && typeof p.heading === "string" && typeof p.text === "string" ? [{ heading: p.heading, text: p.text }] : [],
  );
  const original = { afterSection: story.data.after_section, kind: story.data.kind, title: story.data.title, authorityKey: story.data.authority_key, parts, takeaway: story.data.takeaway };

  const result = await writeAgain("story", STORY_AGAIN_SYSTEM, storyAgainRequest(source.lesson, original));
  if (!result.ok) return { ok: false, message: FAILURES[result.reason] };
  const made = result.reply.stories[0];
  if (!result.reply.found || !made || !sameStory(original, made)) return { ok: false, message: NOT_KEPT };
  const texts = await checked(db, source.courseId, [made.title, made.takeaway, ...made.parts.map((p) => p.text)]);
  if (!texts) return { ok: false, message: NOT_KEPT };
  await countIt(result);
  const [title, takeaway, ...partTexts] = texts;
  return {
    ok: true,
    story: { kind: made.kind, title: title || original.title, takeaway: takeaway || original.takeaway, parts: made.parts.map((p, i) => ({ heading: p.heading, text: partTexts[i] ?? "" })) },
  };
}

const madeSchema = z.object({
  topicId: z.uuid({ error: "That topic could not be found." }),
  aid: z.object({
    kind: z.enum(AID_KINDS),
    title: z.string().trim().min(2).max(200),
    device: z.string().trim().min(1).max(300),
    items: z.array(z.object({ key: z.string().trim().min(1).max(80), meaning: z.string().trim().min(1).max(400) })).max(20),
    explanation: z.string().trim().max(1500).nullable(),
  }),
});

// Save an aid made for the student to their own collection, marked "made for you".
export async function saveMadeAid(input: { topicId: string; aid: MadeAid }): Promise<{ ok: true } | Fail> {
  const parsed = madeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That memory aid could not be saved." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to save memory aids." };
  const db = await createSupabaseServerClient();
  const { aid, topicId } = parsed.data;
  const { error } = await db.from("saved_memory_aids").insert({ topic_id: topicId, kind: aid.kind, title: aid.title, device: aid.device, items: aid.items, explanation: aid.explanation });
  if (error) {
    console.error("save made aid failed", { code: error.code });
    if (error.code === "23514") return { ok: false, message: error.message };
    return { ok: false, message: "It was not saved. Please try again." };
  }
  return { ok: true };
}
