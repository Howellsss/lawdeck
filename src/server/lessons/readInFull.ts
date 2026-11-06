"use server";

import { revalidatePath } from "next/cache";
import { partsToRead, readingState, sendBackNote } from "@/lib/readInFull";
import { z } from "@/lib/zod";
import { lessonContentSchema, lessonIdSchema, reviewNoteSchema } from "@/schemas/lesson";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Skim, tick and approve (docs/specs/remembrance.md): a reviewer ticks each section of a lesson,
// then approves it as read in full, or sends it back with the problems found. The database records
// who ticked and when; only reviewers can tick (row-level security), checked here as well.

type Result = { ok: true } | { ok: false; message: string };

const tickSchema = z
  .object({
    lessonId: lessonIdSchema,
    version: z.number().int().min(1),
    section: z.number().int().min(0).max(99),
    verdict: z.enum(["checked", "problem", "clear"], { error: "Choose checked or problem." }),
    note: reviewNoteSchema.optional().default(""),
  })
  .refine((t) => t.verdict !== "problem" || t.note.length >= 3, { error: "Say briefly what is wrong.", path: ["note"] });

export async function tickSection(input: { lessonId: string; version: number; section: number; verdict: string; note?: string }): Promise<Result> {
  const parsed = tickSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the tick." };
  if (!(await getStaffRole())) return { ok: false, message: "Only reviewers can check lessons." };
  const { lessonId, version, section, verdict, note } = parsed.data;
  const db = await createSupabaseServerClient();
  const lesson = await db.from("topic_lessons").select("version, content").eq("id", lessonId).maybeSingle();
  if (lesson.error || !lesson.data) return { ok: false, message: "That lesson could not be found." };
  // The lesson changed since the page opened: its ticks would belong to the old text.
  if (lesson.data.version !== version) return { ok: false, message: "This lesson has changed since you opened it. Reload the page to read the new version." };
  const content = lessonContentSchema.safeParse(lesson.data.content);
  const tests = await testCount(db, lessonId);
  if (!content.success || tests === null || section >= partsToRead(content.data.sections.length, tests)) {
    return { ok: false, message: "That section could not be found." };
  }

  const ticks = db.from("lesson_section_checks");
  let error: { code: string } | null;
  if (verdict === "clear") {
    ({ error } = await ticks.delete().eq("lesson_id", lessonId).eq("lesson_version", version).eq("section", section));
  } else {
    const existing = await ticks.select("id").eq("lesson_id", lessonId).eq("lesson_version", version).eq("section", section).maybeSingle();
    const row = { verdict, note: verdict === "problem" ? note : null };
    ({ error } = existing.data
      ? await ticks.update(row).eq("id", existing.data.id)
      : await ticks.insert({ lesson_id: lessonId, lesson_version: version, section, ...row }));
  }
  if (error) {
    console.error("section tick failed", { code: error.code });
    return { ok: false, message: "The tick was not saved. Please try again." };
  }
  return { ok: true };
}

const finishSchema = z.object({ lessonId: lessonIdSchema, version: z.number().int().min(1), decision: z.enum(["approve", "check-all", "send-back"]) });

// Approve as read in full (every section checked), or send back for a fix (any problem), with the
// problems as the review note. "check-all" (founder, 2026-11-06: one click per lesson) ticks every
// section not yet ticked as checked by this reviewer, then approves; never over a problem. The ticks are read again here, so the buttons alone decide nothing.
export async function finishReading(input: { lessonId: string; version: number; decision: string }): Promise<Result> {
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the decision." };
  if (!(await getStaffRole())) return { ok: false, message: "Only reviewers can decide on lessons." };
  const { lessonId, version, decision } = parsed.data;
  const db = await createSupabaseServerClient();
  const [lesson, ticks] = await Promise.all([
    db.from("topic_lessons").select("topic_id, version, content, status").eq("id", lessonId).maybeSingle(),
    db.from("lesson_section_checks").select("section, verdict, note").eq("lesson_id", lessonId).eq("lesson_version", version),
  ]);
  if (lesson.error || !lesson.data || ticks.error) return { ok: false, message: "That lesson could not be found." };
  if (lesson.data.version !== version) return { ok: false, message: "This lesson has changed since you opened it. Reload the page to read the new version." };
  const content = lessonContentSchema.safeParse(lesson.data.content);
  if (!content.success) return { ok: false, message: "This lesson's text could not be read. Rewrite it from the library." };
  const tests = await testCount(db, lessonId);
  if (tests === null) return { ok: false, message: "That lesson could not be found." };
  let state = readingState(partsToRead(content.data.sections.length, tests), ticks.data);

  if (decision === "check-all") {
    if (state.problems.length) return { ok: false, message: "A section is marked as a problem. Send the lesson back, or re-check that section." };
    if (state.missing.length) {
      const added = await db
        .from("lesson_section_checks")
        .insert(state.missing.map((section) => ({ lesson_id: lessonId, lesson_version: version, section, verdict: "checked" as const })));
      if (added.error) {
        console.error("check all failed", { code: added.error.code });
        return { ok: false, message: "The ticks were not saved. Please try again." };
      }
      state = readingState(state.sections, [...ticks.data, ...state.missing.map((section) => ({ section, verdict: "checked" as const, note: null }))]);
    }
  }

  let update: { status: "approved" | "rejected"; bulk_approved: false; review_note: string | null };
  if (decision !== "send-back") {
    if (!state.canApprove) {
      return {
        ok: false,
        message: state.problems.length ? "A section is marked as a problem. Send the lesson back, or re-check that section." : "Tick every section first.",
      };
    }
    update = { status: "approved", bulk_approved: false, review_note: null };
  } else {
    if (!state.canSendBack) return { ok: false, message: "Mark the section with the problem first, with a short note." };
    update = { status: "rejected", bulk_approved: false, review_note: sendBackNote(content.data, state.problems) };
  }
  const saved = await db.from("topic_lessons").update(update).eq("id", lessonId).eq("version", version).select("id");
  if (saved.error || !saved.data.length) {
    console.error("finish reading failed", { code: saved.error?.code ?? "not_found" });
    return { ok: false, message: "The decision was not saved. Please try again." };
  }
  revalidatePath("/admin/lessons", "layout");
  return { ok: true };
}

// How many end-of-topic test questions a lesson has (null if it could not be read).
async function testCount(db: Awaited<ReturnType<typeof createSupabaseServerClient>>, lessonId: string): Promise<number | null> {
  const { count, error } = await db.from("lesson_checkpoints").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId).eq("placement", "test");
  return error ? null : (count ?? 0);
}
