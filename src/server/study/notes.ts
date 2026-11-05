"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

const noteSchema = z.object({
  topicId: z.uuid({ error: "That topic could not be found." }),
  body: z.string().max(20_000, { error: "Notes can be up to 20,000 characters." }),
});

// The student's own notes on a topic (founder's brief, 20F): one note per topic, kept with every
// diary entry for that topic. Row-level security keeps it theirs.
export async function saveDiaryNote(input: { topicId: string; body: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Your note could not be saved." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to save notes." };
  const db = await createSupabaseServerClient();
  const existing = await db.from("diary_notes").select("id").eq("topic_id", parsed.data.topicId).maybeSingle();
  const saved = existing.data
    ? await db.from("diary_notes").update({ body: parsed.data.body }).eq("id", existing.data.id)
    : await db.from("diary_notes").insert({ topic_id: parsed.data.topicId, body: parsed.data.body });
  if (saved.error) {
    console.error("diary note failed", { code: saved.error.code });
    return { ok: false, message: "Your note could not be saved. Please try again." };
  }
  revalidatePath("/diary", "layout");
  return { ok: true };
}
