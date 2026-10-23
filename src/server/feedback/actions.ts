"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { reportSchema, takedownSchema, type ReportInput } from "@/schemas/feedback";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Problem reports and takedown requests (Phase 6, step 6f; PRD FB-01, FB-03). Input is checked
// here; the database checks that a report is about the student's own work, and only lets
// reviewers read or close reports and requests. Logs never hold what people wrote (rule I-03).

export type FeedbackResult = { ok: true } | { ok: false; message: string };

const FAILED = "That wasn’t sent. Please try again.";

function logFailure(action: string, code: string | undefined) {
  console.error("feedback action failed", { action, code: code ?? "unknown" });
}

export async function reportProblem(input: ReportInput): Promise<FeedbackResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!(await getCurrentAccount())) return { ok: false, message: "Please sign in again, then try once more." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("problem_reports").insert({
    target_kind: parsed.data.kind,
    target_id: parsed.data.id,
    category: parsed.data.category,
    note: parsed.data.note,
  });
  if (error) {
    logFailure("reportProblem", error.code);
    if (error.code === "23514") return { ok: false, message: "You have sent a lot of reports today. Please try again tomorrow." };
    if (error.code === "23503") return { ok: false, message: "That could not be found. It may have been deleted." };
    return { ok: false, message: FAILED };
  }
  return { ok: true };
}

export type TakedownState = { status: "idle" | "error" | "sent"; message?: string; fieldErrors?: FieldErrors };

// Anyone may send one, signed in or not. A hidden "website" field catches simple spam robots.
export async function submitTakedown(_prev: TakedownState, formData: FormData): Promise<TakedownState> {
  const value = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v.slice(0, 5000) : "";
  };
  if (value("website")) return { status: "sent" };
  const parsed = takedownSchema.safeParse({
    name: value("name"),
    email: value("email").trim(),
    material: value("material"),
    reason: value("reason"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_takedown", parsed.data);
  if (error) {
    logFailure("submitTakedown", error.code);
    if (error.code === "55000") return { status: "error", message: "Too many requests just now. Please try again in an hour." };
    return { status: "error", message: FAILED };
  }
  return { status: "sent" };
}

// Reviewers mark a report resolved (or open again), and a takedown request done (or open again).
export async function setReportStatus(id: string, status: "open" | "resolved"): Promise<FeedbackResult> {
  return setStatus("problem_reports", id, status);
}

export async function setTakedownStatus(id: string, status: "open" | "done"): Promise<FeedbackResult> {
  return setStatus("takedown_requests", id, status);
}

async function setStatus(table: "problem_reports" | "takedown_requests", id: string, status: string): Promise<FeedbackResult> {
  if (!z.uuid().safeParse(id).success || !["open", "resolved", "done"].includes(status)) return { ok: false, message: "That could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Please sign in again, then try once more." };
  const supabase = await createSupabaseServerClient();
  const query =
    table === "problem_reports"
      ? supabase.from("problem_reports").update({ status: status as "open" | "resolved" }).eq("id", id).select("id")
      : supabase.from("takedown_requests").update({ status: status as "open" | "done" }).eq("id", id).select("id");
  const { data, error } = await query;
  if (error) {
    logFailure("setStatus", error.code);
    return { ok: false, message: "That wasn’t saved. Please try again." };
  }
  // Row-level security: only reviewers change anything.
  if (!data || data.length === 0) return { ok: false, message: "That could not be found." };
  refresh();
  return { ok: true };
}
