"use server";

import { z } from "@/lib/zod";
import { parseQuizState, type QuizState } from "@/lib/quiz";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { chatAllowed } from "./data";

// Group quizzes in study groups (migration 61; docs/specs/chat.md). Questions are the approved
// lessons' multiple-choice recall questions: no AI cost. The database keeps the right answer until a
// question closes and checks every rule again (members only, one answer each, the timer).

type Fail = { ok: false; message: string };
const id = z.uuid();

async function ready() {
  const account = await getCurrentAccount();
  if (!account) return { fail: { ok: false, message: "Please sign in again, then try once more." } as Fail } as const;
  const db = await createSupabaseServerClient();
  if (!(await chatAllowed(db))) return { fail: { ok: false, message: "Chat isn’t open to you yet." } as Fail } as const;
  return { fail: null, db } as const;
}

export type QuizTopic = { id: string; course: string; topic: string; questions: number };

export async function quizTopics(): Promise<QuizTopic[]> {
  const r = await ready();
  if (r.fail) return [];
  const { data } = await r.db.rpc("chat_quiz_topics");
  return (data ?? []).map((t) => ({ id: t.topic_id, course: t.course, topic: t.topic, questions: Number(t.questions) }));
}

const createSchema = z.object({ groupId: id, topicId: id, count: z.number().int().min(3).max(10), seconds: z.number().int().min(10).max(60) });

export async function createQuiz(input: z.input<typeof createSchema>): Promise<{ ok: true; quizId: string } | Fail> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a topic, 3 to 10 questions and 10 to 60 seconds each." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { groupId, topicId, count, seconds } = parsed.data;
  const { data, error } = await r.db.rpc("chat_quiz_create", { g: groupId, topic: topicId, how_many: count, secs: seconds });
  if (error) {
    if (error.message.includes("quiz_running")) return { ok: false, message: "A quiz is already on in this group. Join it, or wait until it ends." };
    if (error.message.includes("too_few_questions")) return { ok: false, message: "This topic doesn’t have enough reviewed questions yet. Choose another topic." };
    if (error.message.includes("post_limit")) return { ok: false, message: "You’re sending messages very quickly. Please wait a minute, then try again." };
    if (error.code === "42501") return { ok: false, message: "Quizzes can be hosted in your study groups only." };
    console.error("quiz create failed", { code: error.code });
    return { ok: false, message: "The quiz couldn’t start. Please try again." };
  }
  return { ok: true, quizId: data };
}

// The group's latest quiz (on now, or finished in the last day), for the Quiz tab.
export async function getLatestQuiz(input: { groupId: string }): Promise<QuizState | null> {
  const parsed = id.safeParse(input.groupId);
  if (!parsed.success) return null;
  const r = await ready();
  if (r.fail) return null;
  const { data } = await r.db.rpc("chat_quiz_latest", { g: parsed.data });
  if (!data) return null;
  const state = await r.db.rpc("chat_quiz_state", { q: data });
  return parseQuizState(state.data);
}

export async function quizState(input: { quizId: string }): Promise<QuizState | null> {
  const parsed = id.safeParse(input.quizId);
  if (!parsed.success) return null;
  const r = await ready();
  if (r.fail) return null;
  const { data } = await r.db.rpc("chat_quiz_state", { q: parsed.data });
  return parseQuizState(data);
}

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function step(db: Db, name: "chat_quiz_join" | "chat_quiz_next" | "chat_quiz_end", quizId: string): Promise<{ ok: true } | Fail> {
  const parsed = id.safeParse(quizId);
  if (!parsed.success) return { ok: false, message: "That quiz could not be found." };
  const { data, error } = await db.rpc(name, { q: parsed.data });
  if (error) {
    console.error("quiz step failed", { code: error.code });
    return { ok: false, message: "That didn’t work. Please try again." };
  }
  if (data === "not_allowed") return { ok: false, message: name === "chat_quiz_join" ? "This quiz has ended." : "Only the host can do that." };
  return { ok: true };
}

export async function joinQuiz(input: { quizId: string }): Promise<{ ok: true } | Fail> {
  const r = await ready();
  return r.fail ?? step(r.db, "chat_quiz_join", input.quizId);
}
export async function nextQuestion(input: { quizId: string }): Promise<{ ok: true } | Fail> {
  const r = await ready();
  return r.fail ?? step(r.db, "chat_quiz_next", input.quizId);
}
export async function endQuiz(input: { quizId: string }): Promise<{ ok: true } | Fail> {
  const r = await ready();
  return r.fail ?? step(r.db, "chat_quiz_end", input.quizId);
}

const answerSchema = z.object({ quizId: id, question: z.number().int().min(0).max(9), choice: z.number().int().min(0).max(5) });

export async function answerQuiz(input: z.input<typeof answerSchema>): Promise<{ ok: true } | Fail> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose an answer." };
  const r = await ready();
  if (r.fail) return r.fail;
  const { data, error } = await r.db.rpc("chat_quiz_answer", { q: parsed.data.quizId, question: parsed.data.question, choice: parsed.data.choice });
  if (error) return { ok: false, message: "Your answer wasn’t saved. Please try again." };
  if (data === "late") return { ok: false, message: "Time’s up for this question." };
  if (data === "early") return { ok: false, message: "Wait for the question to open." };
  if (data === "already") return { ok: false, message: "You’ve already answered this one." };
  if (data !== "ok") return { ok: false, message: "Join the quiz to answer." };
  return { ok: true };
}
