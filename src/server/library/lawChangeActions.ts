"use server";

import { refresh } from "next/cache";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { lawChangeIdSchema, lawChangeSchema } from "@/schemas/lawChanges";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export type LawChangeResult = { ok: true; message: string } | { ok: false; message?: string; fieldErrors?: FieldErrors };

const NOT_ALLOWED = "Only reviewers can record changes in the law.";

function logFailure(action: string, code: string | undefined) {
  console.error("law change action failed", { action, code: code ?? "unknown" });
}

// Record a change in the law. Items in that course checked only to an earlier date are then
// marked "Needs re-check" automatically.
export async function addLawChange(input: {
  courseId: string;
  title: string;
  effectiveOn: string;
  note: string;
  source: string;
}): Promise<LawChangeResult> {
  const parsed = lawChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  if (!(await getStaffRole())) return { ok: false, message: NOT_ALLOWED };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("law_changes").insert({
    course_id: parsed.data.courseId,
    title: parsed.data.title,
    effective_on: parsed.data.effectiveOn,
    note: parsed.data.note,
    source: parsed.data.source,
  });
  if (error) {
    logFailure("addLawChange", error.code);
    return { ok: false, message: "The change was not saved. Please try again." };
  }
  refresh();
  return { ok: true, message: "Change recorded. Material checked before that date is now marked “Needs re-check”." };
}

export async function removeLawChange(id: string): Promise<LawChangeResult> {
  const parsed = lawChangeIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "That change could not be found." };
  if (!(await getStaffRole())) return { ok: false, message: NOT_ALLOWED };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("law_changes").delete().eq("id", parsed.data).select("id");
  if (error) {
    logFailure("removeLawChange", error.code);
    return { ok: false, message: "The change was not removed. Please try again." };
  }
  if (data.length === 0) return { ok: false, message: "That change no longer exists." };
  refresh();
  return { ok: true, message: "Change removed." };
}
