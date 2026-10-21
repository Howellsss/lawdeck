"use server";

import { refresh } from "next/cache";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { approvalBlockers, todayInLagos } from "@/lib/reviewRules";
import { passageCorrectionSchema, reviewDecisionSchema } from "@/schemas/libraryReview";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { getLibraryItem } from "@/server/db/library";
import { reindexPassage } from "@/server/retrieval/indexJob";
import { EMBEDDING_MODEL } from "@/server/retrieval/settings";

export type ReviewResult =
  | { ok: true; message: string }
  | { ok: false; message?: string; fieldErrors?: FieldErrors };

const NOT_ALLOWED = "Only reviewers can review library items.";

// Logs the action and error code only, never passage text (rule I-03).
function logFailure(action: string, code: string | undefined) {
  console.error("library review failed", { action, code: code ?? "unknown" });
}

// Approve, reject, withdraw or send back to "awaiting review". The database records who did it
// and when (audit_log) and refuses an approval that breaks the rules, whatever the screen says.
export async function reviewLibraryItem(input: {
  id: string;
  status: string;
  lawCurrentAsOf: string;
  note: string;
}): Promise<ReviewResult> {
  const parsed = reviewDecisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  if (!(await getStaffRole())) return { ok: false, message: NOT_ALLOWED };
  const decision = parsed.data;
  if (decision.lawCurrentAsOf && decision.lawCurrentAsOf > todayInLagos()) {
    return { ok: false, fieldErrors: { lawCurrentAsOf: "The date cannot be in the future." } };
  }

  const item = await getLibraryItem(decision.id);
  if (!item) return { ok: false, message: "That item no longer exists." };
  if (decision.status === "approved") {
    const blockers = approvalBlockers(
      {
        readingStatus: item.reading.status,
        passages: item.reading.passages,
        indexedPassages: item.search.indexed,
        indexModel: item.search.model,
        indexedAt: item.search.indexedAt,
      },
      EMBEDDING_MODEL,
    );
    if (blockers.length > 0) return { ok: false, message: `This item cannot be approved yet. ${blockers.join(" ")}` };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("kb_items")
    .update({ review_status: decision.status, law_current_as_of: decision.lawCurrentAsOf, review_note: decision.note })
    .eq("id", decision.id)
    .select("id");
  if (error) {
    logFailure("reviewLibraryItem", error.code);
    // 23514: one of the database's approval rules (its message is our own plain wording).
    if (error.code === "23514") return { ok: false, message: error.message };
    return { ok: false, message: "The decision was not saved. Please try again." };
  }
  if (data.length === 0) return { ok: false, message: "That item no longer exists." };
  refresh();
  const words = { approved: "approved", rejected: "rejected", withdrawn: "withdrawn", pending: "sent back to awaiting review" };
  return { ok: true, message: `Saved: the item is ${words[decision.status]}.` };
}

// Correct a passage's wording, then re-index it so search uses the new wording.
export async function correctPassage(input: { passageId: string; heading: string; text: string }): Promise<ReviewResult> {
  const parsed = passageCorrectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  if (!(await getStaffRole())) return { ok: false, message: NOT_ALLOWED };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("kb_passages")
    .update({ heading: parsed.data.heading, text: parsed.data.text })
    .eq("id", parsed.data.passageId)
    .select("id");
  if (error) {
    logFailure("correctPassage", error.code);
    return { ok: false, message: "The correction was not saved. Please try again." };
  }
  if (data.length === 0) return { ok: false, message: "That passage no longer exists." };

  const indexed = await reindexPassage(parsed.data.passageId);
  refresh();
  if (!indexed.ok) {
    return {
      ok: true,
      message: `Correction saved. It could not be indexed for search yet (${indexed.message}) An admin can finish it with “Index for search”.`,
    };
  }
  return { ok: true, message: "Correction saved and indexed for search." };
}
