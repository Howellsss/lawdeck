"use server";

import { scheduleAfter, type RecallOutcome } from "@/lib/revision";
import { answerSchema, openSessionSchema, progressSchema, revealSchema, type AnswerInput } from "@/schemas/study";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

type Fail = { ok: false; message: string };
const SIGN_IN: Fail = { ok: false, message: "Sign in to study." };

// Opens today's study session for a topic, or continues it: one per topic per day, so coming
// back the same day never makes a second diary entry (the database enforces it too).
export async function openStudySession(input: { topicId: string }): Promise<
  { ok: true; sessionId: string; sectionsRead: number; completed: boolean } | Fail
> {
  const parsed = openSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That topic could not be found." };
  if (!(await getCurrentAccount())) return SIGN_IN;
  const db = await createSupabaseServerClient();
  const lesson = await db.from("topic_lessons").select("id, version").eq("topic_id", parsed.data.topicId).eq("status", "approved").maybeSingle();
  if (!lesson.data) return { ok: false, message: "This topic's lesson isn't ready yet." };

  const inserted = await db
    .from("study_sessions")
    .insert({ topic_id: parsed.data.topicId, lesson_id: lesson.data.id, lesson_version: lesson.data.version })
    .select("id, sections_read, completed_at")
    .maybeSingle();
  if (inserted.data) return { ok: true, sessionId: inserted.data.id, sectionsRead: 0, completed: false };
  if (inserted.error && inserted.error.code !== "23505") {
    console.error("study session failed", { step: "open", code: inserted.error.code });
    return { ok: false, message: "Your study session couldn't start. Please reload the page." };
  }
  const today = await db
    .from("study_sessions")
    .select("id, sections_read, completed_at")
    .eq("topic_id", parsed.data.topicId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!today.data) return { ok: false, message: "Your study session couldn't start. Please reload the page." };
  return { ok: true, sessionId: today.data.id, sectionsRead: today.data.sections_read, completed: Boolean(today.data.completed_at) };
}

// Saves reading progress: sections read so far (never goes back) and active reading time.
export async function saveStudyProgress(input: { sessionId: string; sectionsRead: number; addSeconds: number }): Promise<{ ok: true } | Fail> {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Progress could not be saved." };
  if (!(await getCurrentAccount())) return SIGN_IN;
  const db = await createSupabaseServerClient();
  const current = await db.from("study_sessions").select("sections_read, active_seconds").eq("id", parsed.data.sessionId).maybeSingle();
  if (!current.data) return { ok: false, message: "Progress could not be saved." };
  const { error } = await db
    .from("study_sessions")
    .update({
      sections_read: Math.max(current.data.sections_read, parsed.data.sectionsRead),
      active_seconds: Math.min(86_400, current.data.active_seconds + parsed.data.addSeconds),
      last_active_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.sessionId);
  if (error) console.error("study progress failed", { code: error.code });
  return error ? { ok: false, message: "Progress could not be saved." } : { ok: true };
}

export async function completeStudySession(input: { sessionId: string }): Promise<{ ok: true } | Fail> {
  const parsed = progressSchema.pick({ sessionId: true }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That study session could not be found." };
  if (!(await getCurrentAccount())) return SIGN_IN;
  const db = await createSupabaseServerClient();
  const { error } = await db.from("study_sessions").update({ completed_at: new Date().toISOString() }).eq("id", parsed.data.sessionId);
  return error ? { ok: false, message: "This session couldn't be marked as finished." } : { ok: true };
}

type Revealed = { ok: true; answer: string; explanation: string | null; correctChoice: number | null };

// Shows an open question's model answer, only once the student has written an attempt or chosen
// to skip (founder's brief: "never reveal the answer before the student attempts the question").
export async function revealAnswer(input: { checkpointId: string; answer?: string; skipped?: boolean }): Promise<Revealed | Fail> {
  const parsed = revealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That question could not be found." };
  if (!parsed.data.skipped && !parsed.data.answer) return { ok: false, message: "Write your answer first, or skip this question." };
  if (!(await getCurrentAccount())) return SIGN_IN;
  const db = await createSupabaseServerClient();
  const row = await db.from("lesson_checkpoints").select("answer, explanation, correct_choice").eq("id", parsed.data.checkpointId).maybeSingle();
  if (!row.data) return { ok: false, message: "That question could not be found." };
  return { ok: true, answer: row.data.answer, explanation: row.data.explanation, correctChoice: row.data.correct_choice };
}

// Records an answer, marks multiple choice on the server, and updates when the question comes
// back for revision. Returns the model answer for display.
export async function recordAnswer(input: AnswerInput): Promise<(Revealed & { outcome: RecallOutcome }) | Fail> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Your answer could not be saved." };
  if (!(await getCurrentAccount())) return SIGN_IN;
  const db = await createSupabaseServerClient();
  const { data: checkpoint } = await db
    .from("lesson_checkpoints")
    .select("id, lesson_id, kind, prompt, key_point, answer, explanation, correct_choice")
    .eq("id", parsed.data.checkpointId)
    .maybeSingle();
  if (!checkpoint) return { ok: false, message: "That question could not be found." };
  const lesson = await db.from("topic_lessons").select("topic_id").eq("id", checkpoint.lesson_id).single();
  if (lesson.error) return { ok: false, message: "That question could not be found." };

  const input2 = parsed.data;
  let outcome: RecallOutcome;
  if (input2.skipped) outcome = "skipped";
  else if (checkpoint.kind === "mcq") {
    if (input2.choice === null) return { ok: false, message: "Choose an answer first." };
    outcome = input2.choice === checkpoint.correct_choice ? "correct" : "incorrect";
  } else {
    if (!input2.selfOutcome) return { ok: false, message: "Say how your answer compared." };
    outcome = input2.selfOutcome;
  }

  const topicId = lesson.data.topic_id;
  const saved = await db.from("recall_attempts").insert({
    session_id: input2.sessionId,
    topic_id: topicId,
    checkpoint_id: checkpoint.id,
    prompt: checkpoint.prompt,
    key_point: checkpoint.key_point,
    context: input2.context,
    answer: input2.answer || null,
    choice: input2.choice,
    outcome,
  });
  if (saved.error) {
    console.error("recall answer failed", { step: "attempt", code: saved.error.code });
    return { ok: false, message: "Your answer could not be saved. Please try again." };
  }

  const existing = await db
    .from("review_items")
    .select("id, interval_days, successes, lapses, due_at, ease")
    .eq("checkpoint_id", checkpoint.id)
    .maybeSingle();
  const next = scheduleAfter(existing.data ?? null, outcome, input2.context);
  const schedule = existing.data
    ? await db.from("review_items").update(next).eq("id", existing.data.id)
    : await db.from("review_items").insert({ checkpoint_id: checkpoint.id, topic_id: topicId, ...next });
  if (schedule.error) console.error("recall answer failed", { step: "schedule", code: schedule.error.code });

  return { ok: true, outcome, answer: checkpoint.answer, explanation: checkpoint.explanation, correctChoice: checkpoint.correct_choice };
}
