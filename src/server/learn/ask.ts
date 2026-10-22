import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { questionMessage, type AnswerLevel, type ExplainPassage } from "@/prompts/explain";
import { streamExplanation, type ExplainResult, type ExplainTurn } from "@/server/ai/explain";
import type { ExplainModel } from "@/server/ai/models";
import { pagesLabel } from "@/lib/pages";
import type { Database } from "@/server/db/types";
import type { ChatSource } from "@/server/db/workspace";
import { searchLibrary, type SearchHit } from "@/server/retrieval/search";
import { limitReachedMessage } from "@/lib/allowance";
import { ALLOWANCE_UNAVAILABLE, getAllowance, hasQuestionsLeft } from "./allowance";
import { AnswerFilter, citedLabels, NOT_ENOUGH_HEADING, REMOVED_AUTHORITY } from "./answerFilter";
import { filterContextFor } from "./filterContext";
import { redactPersonalData } from "./redact";

type Db = SupabaseClient<Database>;

// How many earlier messages go with each question, so follow-ups make sense.
const HISTORY_MESSAGES = 6;
const TITLE_CHARS = 80;

export type SourceSummary = ChatSource;

// One line of the answer stream (newline-delimited JSON).
export type AnswerEvent =
  | { type: "text"; text: string }
  | { type: "done"; messageId: string; text: string; sources: SourceSummary[]; notEnough: boolean; level: AnswerLevel }
  | { type: "error"; message: string };

export const NO_MATERIAL_TEXT = `${NOT_ENOUGH_HEADING}
The library has no approved material that matches this question yet, so Lawdeck won't guess. Try a narrower question, name the topic you mean, or choose the course it belongs to.`;

const FAILURES = {
  no_key: "Answers are not switched on yet: the Claude key is missing on the server.",
  busy: "Lawdeck is busy right now. Please try again in a minute.",
  refused: "Lawdeck can't answer that question. Try asking it a different way.",
  unavailable: "Lawdeck could not reach the answer service. Please try again in a minute.",
  cancelled: "The answer was stopped.",
} as const;

// Answers a question in the student's own chat, sending events as the answer streams.
// The caller has checked sign-in and the request's origin; row-level security limits every
// read and write to this student's own chat.
export async function answerQuestion(input: {
  db: Db;
  userId: string;
  chatId: string;
  question: string;
  level: AnswerLevel;
  send: (event: AnswerEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { db, send } = input;
  const chat = await db.from("conversations").select("id, title, course_id").eq("id", input.chatId).maybeSingle();
  if (chat.error || !chat.data) return send({ type: "error", message: "That chat could not be found." });

  // Rule K-01: the monthly limit is checked before anything is saved or any AI is called.
  const allowance = await getAllowance(db);
  if (!allowance) return send({ type: "error", message: ALLOWANCE_UNAVAILABLE });
  if (!hasQuestionsLeft(allowance)) return send({ type: "error", message: limitReachedMessage(allowance) });

  const earlier = await db
    .from("messages")
    .select("role, content")
    .eq("conversation_id", input.chatId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MESSAGES);
  if (earlier.error) return send({ type: "error", message: "The chat could not be loaded. Please try again." });

  const asked = await db.from("messages").insert({
    conversation_id: input.chatId,
    role: "user",
    content: { text: input.question, level: input.level },
  });
  if (asked.error) return send({ type: "error", message: "Your question was not saved. Please try again." });
  if (chat.data.title === "New chat") {
    await db.from("conversations").update({ title: titleFrom(input.question) }).eq("id", input.chatId);
  }

  // Rule G-06: nothing that looks like an email address or phone number leaves Lawdeck.
  const question = redactPersonalData(input.question);
  const found = await searchLibrary({ question, courseId: chat.data.course_id, includePending: false });
  if (!found.ok) return send({ type: "error", message: found.message });
  const unsure = searchUnsure(found);
  if (unsure) return send({ type: "error", message: unsure });
  if (found.hits.length === 0) {
    const saved = await saveAnswer(db, input.chatId, NO_MATERIAL_TEXT, input.level, null, []);
    if (!saved) return send({ type: "error", message: "The answer was not saved. Please try again." });
    return send({ type: "done", messageId: saved, text: NO_MATERIAL_TEXT, sources: [], notEnough: true, level: input.level });
  }

  const composed = await composeAnswer({
    db,
    hits: found.hits,
    question,
    level: input.level,
    history: historyTurns(earlier.data),
    courseId: chat.data.course_id,
    userId: input.userId,
    onText: (text) => send({ type: "text", text }),
    signal: input.signal,
  });
  if (!composed.ok) return send({ type: "error", message: FAILURES[composed.reason] });
  const { shown, notEnough, used, result } = composed;

  const messageId = await saveAnswer(db, input.chatId, shown, input.level, result, used);
  if (!messageId) return send({ type: "error", message: "The answer was not saved. Please try again." });
  const sources = await saveSources(db, messageId, used);
  send({ type: "done", messageId, text: shown, sources, notEnough, level: input.level });
}

export type ComposedAnswer =
  | {
      ok: true;
      shown: string;
      notEnough: boolean;
      // The passages the checked answer cites (none for "not enough").
      used: (SearchHit & { label: number })[];
      // How many authorities the citation check removed (step 3e counts these: must be zero).
      removedAuthorities: number;
      // Claude's wording before the check (the answer test saves it privately; the app does not).
      raw: string;
      result: Extract<ExplainResult, { ok: true }>;
    }
  | { ok: false; reason: keyof typeof FAILURES };

// The heart of an answer, shared by the app and the model test (step 3e): label the passages,
// stream Claude's explanation through the citation and quotation check, and work out which
// passages the checked answer cites. Saving is left to the caller.
export async function composeAnswer(input: {
  db: Db;
  hits: SearchHit[];
  question: string;
  level: AnswerLevel;
  history: ExplainTurn[];
  courseId: string | null;
  userId: string;
  onText: (text: string) => void;
  signal?: AbortSignal;
  model?: ExplainModel;
}): Promise<ComposedAnswer> {
  const hits = input.hits.map((hit, index) => ({ ...hit, label: index + 1 }));
  const filter = new AnswerFilter(await filterContextFor(input.db, hits, input.courseId));
  const passages: ExplainPassage[] = hits.map((hit) => ({
    label: hit.label,
    itemTitle: hit.itemTitle,
    heading: hit.heading,
    pages: pagesLabel(hit.pageFrom, hit.pageTo),
    text: hit.text,
  }));
  const turns: ExplainTurn[] = [...input.history, { role: "user", text: questionMessage(passages, input.question, input.level) }];

  let shown = "";
  let raw = "";
  const show = (text: string) => {
    if (!text) return;
    shown += text;
    input.onText(text);
  };
  // The check may ask the library before letting a sentence through, so pieces are checked one
  // after another, in order.
  let checking: Promise<void> = Promise.resolve();
  const result = await streamExplanation({
    turns,
    userId: input.userId,
    onText: (text) => {
      raw += text;
      checking = checking.then(async () => show(await filter.push(text)));
    },
    signal: input.signal,
    model: input.model,
  });
  await checking;
  if (!result.ok) return { ok: false, reason: result.reason };
  show(await filter.end());
  if (!shown.trim()) return { ok: false, reason: "unavailable" };

  const cited = filter.notEnough ? [] : citedLabels(shown).map((label) => hits.find((hit) => hit.label === label));
  const used = cited.filter((hit): hit is SearchHit & { label: number } => hit !== undefined);
  const removedAuthorities = shown.split(REMOVED_AUTHORITY).length - 1;
  return { ok: true, shown, notEnough: filter.notEnough, used, removedAuthorities, raw, result };
}

export const SEARCH_BUSY =
  "Lawdeck's library search is busy right now, so it can't check the library properly for this question. Please try again in a minute.";

// Nothing found only means "not in the library" when search by meaning ran. If only the
// exact-words search ran (Voyage busy or unreachable), saying the library has nothing could be
// wrong, so the student is asked to try again instead (never invent a result).
export function searchUnsure(found: { hits: unknown[]; meaningUsed: boolean }): string | null {
  if (found.hits.length === 0 && !found.meaningUsed) {
    console.warn("learn answer search unsure", { meaningUsed: false });
    return SEARCH_BUSY;
  }
  return null;
}

export function titleFrom(question: string): string {
  const flat = question.replace(/\s+/g, " ").trim();
  return flat.length > TITLE_CHARS ? `${flat.slice(0, TITLE_CHARS - 1)}…` : flat || "New chat";
}

function textOf(content: unknown): string {
  return content && typeof content === "object" && "text" in content && typeof content.text === "string" ? content.text : "";
}

// Earlier messages, oldest first. Old citation numbers refer to old passages, so they are dropped.
export function historyTurns(rows: { role: "user" | "assistant"; content: unknown }[]): ExplainTurn[] {
  const turns = rows
    .slice()
    .reverse()
    .map((row) => ({
      role: row.role,
      text: (row.role === "user" ? redactPersonalData(textOf(row.content)) : textOf(row.content).replace(/\[S\d+\]/g, "")).trim(),
    }))
    .filter((turn) => turn.text);
  // Claude needs the conversation to start with the student and alternate.
  while (turns.length && turns[0].role !== "user") turns.shift();
  const alternating: ExplainTurn[] = [];
  for (const turn of turns) {
    if (alternating.at(-1)?.role === turn.role) alternating[alternating.length - 1] = turn;
    else alternating.push(turn);
  }
  if (alternating.at(-1)?.role === "user") alternating.pop();
  return alternating;
}

async function saveAnswer(
  db: Db,
  chatId: string,
  text: string,
  level: AnswerLevel,
  usage: { model: string; tokensIn: number; tokensOut: number; costUsd: number | null } | null,
  used: { label: number }[],
): Promise<string | null> {
  const { data, error } = await db
    .from("messages")
    .insert({
      conversation_id: chatId,
      role: "assistant",
      content: { text, level, sources: used.map((hit) => hit.label) },
      model: usage?.model ?? null,
      tokens_in: usage?.tokensIn ?? null,
      tokens_out: usage?.tokensOut ?? null,
      cost_usd: usage?.costUsd ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("learn answer failed", { step: "save", code: error.code });
    return null;
  }
  return data.id;
}

async function saveSources(db: Db, messageId: string, used: (SearchHit & { label: number })[]): Promise<SourceSummary[]> {
  if (used.length === 0) return [];
  const { data, error } = await db
    .from("message_sources")
    .insert(
      used.map((hit) => ({
        message_id: messageId,
        label: hit.label,
        kb_passage_id: hit.passageId,
        item_title: hit.itemTitle.slice(0, 300),
        heading: hit.heading?.slice(0, 500) ?? null,
        page_from: hit.pageFrom,
        page_to: hit.pageTo,
      })),
    )
    .select("id, label, item_title, heading, page_from, page_to");
  if (error) {
    console.error("learn answer failed", { step: "sources", code: error.code });
    return [];
  }
  return data
    .map((row) => ({
      id: row.id,
      label: row.label,
      itemTitle: row.item_title,
      heading: row.heading,
      pages: pagesLabel(row.page_from, row.page_to),
    }))
    .sort((a, b) => a.label - b.label);
}
