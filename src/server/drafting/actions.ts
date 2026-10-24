"use server";

import { limitReachedMessage } from "@/lib/allowance";
import { draftingIdSchema, draftRequestSchema, newDraftSchema } from "@/schemas/drafting";
import { pickTemplate } from "@/server/ai/draftPick";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { ALLOWANCE_UNAVAILABLE, getAllowance, hasQuestionsLeft } from "@/server/learn/allowance";
import { redactPersonalData } from "@/server/learn/redact";
import { createDraft } from "./create";

// Drafting actions (Phase 5, step 5d). Input is checked with Zod and sign-in on the server;
// row-level security keeps documents to their owner and allows approved templates only.

export type StartDraftResult = { ok: true; id: string } | { ok: false; message: string; signIn?: boolean };

export async function startDraft(input: unknown): Promise<StartDraftResult> {
  const parsed = newDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the answers and try again." };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, signIn: true, message: "Sign in to draft documents." };
  const supabase = await createSupabaseServerClient();
  return createDraft(supabase, account.id, parsed.data);
}

// `matched` is false when no reviewed template fits; the href is then the catalogue.
export type OpenDraftResult =
  | { ok: true; href: string; matched: boolean }
  | { ok: false; message: string; signIn?: boolean };

// A typed request ("Draft a writ of summons") becomes the matching template's intake (DR-02).
// When nothing matches, the student chooses from the catalogue; nothing is drafted yet.
export async function openDraft(input: { request: string; course: string }): Promise<OpenDraftResult> {
  const parsed = draftRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Say which document you need." };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, signIn: true, message: "Sign in to draft documents." };
  const supabase = await createSupabaseServerClient();

  // Rule K-01: no AI call once this month's questions are used up.
  const allowance = await getAllowance(supabase);
  if (!allowance) return { ok: false, message: ALLOWANCE_UNAVAILABLE };
  if (!hasQuestionsLeft(allowance)) return { ok: false, message: limitReachedMessage(allowance) };

  let query = supabase.from("templates").select("slug, title, course_id").eq("status", "approved").order("title").limit(200);
  if (parsed.data.course !== "all") {
    const course = await supabase.from("courses").select("id").eq("slug", parsed.data.course).maybeSingle();
    if (course.error || !course.data) return { ok: false, message: "That course could not be found." };
    query = query.eq("course_id", course.data.id);
  }
  const { data, error } = await query;
  if (error) {
    console.error("drafting action failed", { action: "openDraft", code: error.code });
    return { ok: false, message: "Lawdeck couldn’t open the drafting catalogue just now. Please try again." };
  }
  const picked = await pickTemplate(redactPersonalData(parsed.data.request), data.map((t) => t.title), account.id);
  if (picked === null) return { ok: true, href: "/drafting?unmatched=1", matched: false };
  return { ok: true, href: `/drafting/${data[picked].slug}`, matched: true };
}

export async function deleteDocument(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!draftingIdSchema.safeParse(id).success) return { ok: false, message: "That document could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in first." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) {
    console.error("drafting action failed", { action: "delete", code: error.code });
    return { ok: false, message: "The document was not deleted. Please try again." };
  }
  return { ok: true };
}
