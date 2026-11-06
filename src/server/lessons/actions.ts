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
    // Approved on its own page: read in full, so not marked as approved with its course.
    .update({ status: parsed.data.status, review_note: parsed.data.note || null, bulk_approved: false })
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

const extrasDecisionSchema = z.object({
  extrasId: z.uuid({ error: "Those memory aids could not be found." }),
  status: z.enum(["approved", "rejected", "withdrawn", "pending"], { error: "Choose a decision." }),
  note: reviewNoteSchema.optional().default(""),
});

// A reviewer's decision on a lesson's memory aids and stories, reviewed as one set. Students see
// them only when both the set and its lesson are approved (the database checks both).
export async function decideExtras(input: { extrasId: string; status: string; note?: string }): Promise<ActionResult> {
  const parsed = extrasDecisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the decision." };
  if (!(await getStaffRole())) return { ok: false, message: "Only reviewers can decide on memory aids." };
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("lesson_extras")
    .update({ status: parsed.data.status, review_note: parsed.data.note || null, bulk_approved: false })
    .eq("id", parsed.data.extrasId)
    .select("id");
  if (error || !data?.length) {
    console.error("memory aids decision failed", { code: error?.code ?? "not_found" });
    return { ok: false, message: "The decision was not saved. Please try again." };
  }
  revalidatePath("/admin/lessons", "layout");
  return { ok: true };
}

const courseSchema = z.object({ courseId: z.uuid({ error: "That course could not be found." }) });

// Approve every set of memory aids and stories awaiting review in one course at once (founder's
// decision, 2026-11-05, Phase 2). Marked, like before. Lessons themselves are no longer approved a
// course at a time (founder, 2026-11-06): each goes through Read in full.
export async function approveCourseExtras(input: { courseId: string }): Promise<{ ok: true; approved: number } | { ok: false; message: string }> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That course could not be found." };
  if (!(await getStaffRole())) return { ok: false, message: "Only reviewers can approve memory aids." };
  const db = await createSupabaseServerClient();
  const topics = await db.from("topics").select("id").eq("course_id", parsed.data.courseId);
  if (topics.error) {
    console.error("course approval failed", { code: topics.error.code });
    return { ok: false, message: "The memory aids were not approved. Please try again." };
  }
  if (topics.data.length === 0) return { ok: true, approved: 0 };
  const lessons = await db
    .from("topic_lessons")
    .select("id")
    .in(
      "topic_id",
      topics.data.map((t) => t.id),
    );
  if (lessons.error) {
    console.error("course approval failed", { code: lessons.error.code });
    return { ok: false, message: "The memory aids were not approved. Please try again." };
  }
  if (lessons.data.length === 0) return { ok: true, approved: 0 };
  const { data, error } = await db
    .from("lesson_extras")
    .update({ status: "approved", bulk_approved: true })
    .eq("status", "pending")
    .in(
      "lesson_id",
      lessons.data.map((l) => l.id),
    )
    .select("id");
  if (error) {
    console.error("course approval failed", { code: error.code });
    return { ok: false, message: "The memory aids were not approved. Please try again." };
  }
  revalidatePath("/admin/lessons", "layout");
  return { ok: true, approved: data.length };
}

const partSchema = z.object({ kind: z.enum(["checkpoint", "authority", "aid", "story"]), id: z.uuid({ error: "That item could not be found." }) });

// A reviewer removes one question or authority card that is wrong. The lesson goes back to review
// (the database does this), so nothing changes for students until it is approved again.
export async function removeLessonPart(input: { kind: string; id: string }): Promise<ActionResult> {
  const parsed = partSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That item could not be found." };
  if (!(await getStaffRole())) return { ok: false, message: "Only reviewers can change lessons." };
  const db = await createSupabaseServerClient();
  const tables = { checkpoint: "lesson_checkpoints", authority: "lesson_authorities", aid: "lesson_memory_aids", story: "lesson_stories" } as const;
  const table = tables[parsed.data.kind];
  const { error } = await db.from(table).delete().eq("id", parsed.data.id);
  if (error) {
    console.error("lesson part removal failed", { code: error.code });
    return { ok: false, message: "It was not removed. Please try again." };
  }
  revalidatePath("/admin/lessons", "layout");
  return { ok: true };
}
