"use server";

import { refresh } from "next/cache";
import { rateEvalAnswerSchema } from "@/schemas/evals";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export type RateResult = { ok: true } | { ok: false; message: string };

// The legal reviewer rates one test answer (step 3e). Reviewers and admins only: the role is
// checked here, and row-level security checks it again. Who rated it and when is set by the database.
export async function rateEvalAnswer(input: { id: string; rating: string; note: string }): Promise<RateResult> {
  const parsed = rateEvalAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the rating." };
  if (!(await getStaffRole())) return { ok: false, message: "Only reviewers can rate test answers." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("eval_answers")
    .update({ rating: parsed.data.rating, review_note: parsed.data.note || null })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data?.length) {
    console.error("eval rating failed", { code: error?.code ?? "no_row" });
    return { ok: false, message: "The rating wasn’t saved. Please try again." };
  }
  refresh();
  return { ok: true };
}
