"use server";

import { refresh } from "next/cache";
import { createShareSchema, shareIdSchema, type ShareKind } from "@/schemas/sharing";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Creating and revoking view-only share links (Phase 6, step 6d; PRD EX-04). Sign-in and input
// are checked here; the database only lets a student share their own document or project, and
// only lets them revoke their own links. Logs hold the action and error code only (rule I-03).

export type ShareResult = { ok: true } | { ok: false; message: string };

const SIGN_IN = "Please sign in again, then try once more.";
const FAILED = "That didn’t work. Please try again.";

function logFailure(action: string, code: string | undefined) {
  console.error("share action failed", { action, code: code ?? "unknown" });
}

export async function createShare(kind: ShareKind, id: string): Promise<ShareResult> {
  const parsed = createShareSchema.safeParse({ kind, id });
  if (!parsed.success) return { ok: false, message: "That could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: SIGN_IN };

  const supabase = await createSupabaseServerClient();
  const { kind: what, id: target } = parsed.data;
  const { error } = await supabase.from("shares").insert({
    kind: what,
    document_id: what === "document" ? target : null,
    project_id: what === "project" ? target : null,
  });
  if (error) {
    logFailure("createShare", error.code);
    // 23503: not one of the student's own documents or projects (or it was just deleted).
    return { ok: false, message: error.code === "23503" ? "That could not be found. It may have been deleted." : FAILED };
  }
  refresh();
  return { ok: true };
}

export async function revokeShare(id: string): Promise<ShareResult> {
  const parsed = shareIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!(await getCurrentAccount())) return { ok: false, message: SIGN_IN };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("revoked_at", null)
    .select("id");
  if (error) {
    logFailure("revokeShare", error.code);
    return { ok: false, message: FAILED };
  }
  if (data.length === 0) return { ok: false, message: "That link was already turned off." };
  refresh();
  return { ok: true };
}
