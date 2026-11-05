"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";
import { lessonIdSchema, reviewNoteSchema } from "@/schemas/lesson";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

type ActionResult = { ok: true } | { ok: false; message: string };

const decisionSchema = z.object({
  lessonId: lessonIdSchema,
  status: z.enum(["approved", "rejected", "withdrawn", "pending"], { error: "Choose a decision." }),
  note: reviewNoteSchema.optional().default(""),
});

// A reviewer's decision on a lesson. The database checks the role again and records who decided
// and when; a lesson must have content to be approved.
export async function decideLesson(input: { lessonId: string; status: string; note?: string }): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the decision." };
  if (!(await getStaffRole())) return { ok: false, message: "Only reviewers can decide on lessons." };
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("topic_lessons")
    .update({ status: parsed.data.status, review_note: parsed.data.note || null })
    .eq("id", parsed.data.lessonId)
    .select("topic_id")
    .maybeSingle();
  if (error || !data) {
    console.error("lesson decision failed", { code: error?.code ?? "not_found" });
    return { ok: false, message: "The decision was not saved. Please try again." };
  }
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${data.topic_id}`);
  return { ok: true };
}

const partSchema = z.object({ kind: z.enum(["checkpoint", "authority"]), id: z.uuid({ error: "That item could not be found." }) });

// A reviewer removes one question or authority card that is wrong. The lesson goes back to review
// (the database does this), so nothing changes for students until it is approved again.
export async function removeLessonPart(input: { kind: string; id: string }): Promise<ActionResult> {
  const parsed = partSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That item could not be found." };
  if (!(await getStaffRole())) return { ok: false, message: "Only reviewers can change lessons." };
  const db = await createSupabaseServerClient();
  const table = parsed.data.kind === "checkpoint" ? "lesson_checkpoints" : "lesson_authorities";
  const { error } = await db.from(table).delete().eq("id", parsed.data.id);
  if (error) {
    console.error("lesson part removal failed", { code: error.code });
    return { ok: false, message: "It was not removed. Please try again." };
  }
  revalidatePath("/admin/lessons", "layout");
  return { ok: true };
}
