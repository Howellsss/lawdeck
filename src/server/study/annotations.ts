"use server";

import { ANNOTATION_STYLES, type Annotation } from "@/lib/annotations";
import { z } from "@/lib/zod";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

type Fail = { ok: false; message: string };
const NOT_SAVED = "Your mark was not saved. Please try again.";

const place = {
  section: z.number().int().min(0).max(199),
  paragraph: z.number().int().min(0).max(199),
  start: z.number().int().min(0).max(20_000),
  end: z.number().int().min(1).max(20_000),
};
const noteSchema = z.string().trim().max(2000, { error: "Notes can be up to 2,000 characters." });

const addSchema = z
  .object({
    topicId: z.uuid({ error: "That topic could not be found." }),
    lessonId: z.uuid({ error: "That lesson could not be found." }),
    ...place,
    quote: z.string().min(1).max(500, { error: "Mark up to 500 characters at a time." }),
    style: z.enum(ANNOTATION_STYLES),
    note: noteSchema.optional().default(""),
  })
  .refine((v) => v.end > v.start && v.end - v.start === v.quote.length, { error: "Select the words again and retry." });

// Save a student's own mark (founder's brief, section 30: "save their annotations automatically").
// Private to the student; the database checks the lesson is one they can read.
export async function addAnnotation(input: z.input<typeof addSchema>): Promise<{ ok: true; annotation: Annotation } | Fail> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? NOT_SAVED };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to mark lessons." };
  const v = parsed.data;
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("lesson_annotations")
    .insert({
      topic_id: v.topicId,
      lesson_id: v.lessonId,
      section: v.section,
      paragraph: v.paragraph,
      start_offset: v.start,
      end_offset: v.end,
      quote: v.quote,
      style: v.style,
      note: v.note || null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("add annotation failed", { code: error.code });
    return { ok: false, message: error.code === "23514" ? error.message : NOT_SAVED };
  }
  return {
    ok: true,
    annotation: { id: data.id, lessonId: v.lessonId, section: v.section, paragraph: v.paragraph, start: v.start, end: v.end, quote: v.quote, style: v.style, note: v.note || null },
  };
}

const changeSchema = z.object({
  id: z.uuid({ error: "That mark could not be found." }),
  style: z.enum(ANNOTATION_STYLES),
  note: noteSchema,
});

// Change a mark's look or its note.
export async function changeAnnotation(input: { id: string; style: string; note: string }): Promise<{ ok: true } | Fail> {
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? NOT_SAVED };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to mark lessons." };
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("lesson_annotations")
    .update({ style: parsed.data.style, note: parsed.data.note || null })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data?.length) {
    console.error("change annotation failed", { code: error?.code ?? "not_found" });
    return { ok: false, message: NOT_SAVED };
  }
  return { ok: true };
}

// Remove a mark (row-level security keeps it to the student's own).
export async function removeAnnotation(input: { id: string }): Promise<{ ok: true } | Fail> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "That mark could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in to mark lessons." };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("lesson_annotations").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("remove annotation failed", { code: error.code });
    return { ok: false, message: "It was not removed. Please try again." };
  }
  return { ok: true };
}
