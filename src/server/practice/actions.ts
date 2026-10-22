"use server";

import { parseChoices, parsePracticeSources, type PracticeReveal } from "@/lib/practice";
import { flashcardMarkSchema, mcqAnswerSchema, newPracticeSetSchema, practiceSetIdSchema } from "@/schemas/practice";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { createPracticeSet } from "./create";

// Practice actions (Phase 4, step 4b). Each checks input with Zod and sign-in on the server;
// row-level security keeps every set, question and answer to its owner (System Design §4.2).

export type CreatePracticeActionResult = { ok: true; id: string } | { ok: false; message: string; signIn?: boolean };

export async function startPracticeSet(input: { topicId: string; kind: string; count?: number | string }): Promise<CreatePracticeActionResult> {
  const parsed = newPracticeSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Choose a topic and a type." };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, signIn: true, message: "Sign in to practise." };
  const supabase = await createSupabaseServerClient();
  const made = await createPracticeSet(supabase, account.id, parsed.data);
  return made.ok ? { ok: true, id: made.id } : made;
}

export type RevealResult = ({ ok: true; correct: boolean | null } & PracticeReveal) | { ok: false; message: string };

const NOT_FOUND = "That question could not be found.";

// A multiple-choice answer: the server decides whether it is right, saves the attempt and only
// then reveals the correct option, the explanation and the sources.
export async function answerMultipleChoice(input: { itemId: string; choice: number }): Promise<RevealResult> {
  const parsed = mcqAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to practise." };
  const supabase = await createSupabaseServerClient();
  const item = await supabase.from("practice_items").select("id, choices, correct_choice, answer, sources").eq("id", parsed.data.itemId).maybeSingle();
  const choices = parseChoices(item.data?.choices);
  if (item.error || !item.data || !choices || item.data.correct_choice === null || parsed.data.choice >= choices.length) {
    return { ok: false, message: NOT_FOUND };
  }
  const correct = parsed.data.choice === item.data.correct_choice;
  const saved = await supabase.from("attempts").insert({ item_id: item.data.id, choice: parsed.data.choice, score: correct ? 100 : 0 });
  if (saved.error) {
    console.error("practice action failed", { action: "answer", code: saved.error.code });
    return { ok: false, message: "Your answer was not saved. Please try again." };
  }
  return { ok: true, correct, answer: item.data.answer, correctChoice: item.data.correct_choice, sources: parsePracticeSources(item.data.sources) };
}

// A scenario's model answer, when the student asks to see it.
export async function revealModelAnswer(itemId: string): Promise<RevealResult> {
  if (!practiceSetIdSchema.safeParse(itemId).success) return { ok: false, message: NOT_FOUND };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to practise." };
  const supabase = await createSupabaseServerClient();
  const item = await supabase.from("practice_items").select("answer, correct_choice, sources").eq("id", itemId).maybeSingle();
  if (item.error || !item.data) return { ok: false, message: NOT_FOUND };
  return { ok: true, correct: null, answer: item.data.answer, correctChoice: item.data.correct_choice, sources: parsePracticeSources(item.data.sources) };
}

// A flashcard marked "know it" (true) or "not yet" (false); null clears the mark. Row-level
// security lets a student change only this mark, and only on their own cards (migration 17).
export async function markFlashcard(input: { itemId: string; known: boolean | null }): Promise<{ ok: boolean; message?: string }> {
  const parsed = flashcardMarkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That card could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to practise." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("practice_items").update({ known: parsed.data.known }).eq("id", parsed.data.itemId).select("id");
  if (error || !data?.length) {
    if (error) console.error("practice action failed", { action: "markFlashcard", code: error.code });
    return { ok: false, message: "That card was not saved. Please try again." };
  }
  return { ok: true };
}

export async function deletePracticeSet(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!practiceSetIdSchema.safeParse(id).success) return { ok: false, message: "That practice set could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in first." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("practice_sets").delete().eq("id", id);
  if (error) {
    console.error("practice action failed", { action: "delete", code: error.code });
    return { ok: false, message: "The practice set was not deleted. Please try again." };
  }
  return { ok: true };
}
