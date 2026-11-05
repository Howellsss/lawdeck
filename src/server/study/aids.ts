"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

type Fail = { ok: false; message: string };
const aidSchema = z.object({ aidId: z.uuid({ error: "That memory aid could not be found." }) });

// Save a memory aid to the student's own collection (founder's brief: "save their preferred memory
// aids"). The database copies the aid itself and only for an aid the student can read.
export async function saveMemoryAid(input: { aidId: string }): Promise<{ ok: true } | Fail> {
  const parsed = aidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That memory aid could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to save memory aids." };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("saved_memory_aids").insert({ aid_id: parsed.data.aidId });
  // 23505: already saved, which is what the student wanted.
  if (error && error.code !== "23505") {
    console.error("save memory aid failed", { code: error.code });
    if (error.code === "23514") return { ok: false, message: error.message };
    return { ok: false, message: "It was not saved. Please try again." };
  }
  revalidatePath("/diary", "layout");
  return { ok: true };
}

const removeSchema = z.union([aidSchema, z.object({ savedId: z.uuid({ error: "That memory aid could not be found." }) })]);

// Remove a saved aid, by the aid (from the lesson) or by the saved copy (from the list, which also
// holds aids from earlier versions of a lesson). Row-level security keeps it to the student's own.
export async function removeSavedAid(input: { aidId: string } | { savedId: string }): Promise<{ ok: true } | Fail> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That memory aid could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to change your memory aids." };
  const db = await createSupabaseServerClient();
  const query = db.from("saved_memory_aids").delete();
  const { error } = await ("savedId" in parsed.data ? query.eq("id", parsed.data.savedId) : query.eq("aid_id", parsed.data.aidId));
  if (error) {
    console.error("remove saved aid failed", { code: error.code });
    return { ok: false, message: "It was not removed. Please try again." };
  }
  revalidatePath("/diary", "layout");
  return { ok: true };
}

const storyAnswerSchema = z.object({
  storyId: z.uuid({ error: "That story could not be found." }),
  choice: z.number().int().min(0).max(5),
});

// A story's quick question, marked on the server: the right choice is only sent after the student
// has chosen (founder's brief: the answer stays hidden until the student tries).
export async function checkStoryAnswer(input: {
  storyId: string;
  choice: number;
}): Promise<{ ok: true; correct: boolean; correctChoice: number; explanation: string | null } | Fail> {
  const parsed = storyAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Choose an answer." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to answer." };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("lesson_stories").select("correct_choice, explanation").eq("id", parsed.data.storyId).maybeSingle();
  if (error || !data || data.correct_choice === null) return { ok: false, message: "That question could not be checked. Please try again." };
  return { ok: true, correct: data.correct_choice === parsed.data.choice, correctChoice: data.correct_choice, explanation: data.explanation };
}
