"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { reportSchema, takedownSchema, type ReportInput } from "@/schemas/feedback";
import { getStaffRole } from "@/server/auth/roles";
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
// The role is checked here and again by the database (row-level security).
const reportStatusSchema = z.object({ id: z.uuid(), status: z.enum(["open", "resolved"]) });
const takedownStatusSchema = z.object({ id: z.uuid(), status: z.enum(["open", "done"]) });
const NOT_FOUND = "That could not be found.";
const NOT_REVIEWER = "Only reviewers can change this.";

export async function setReportStatus(id: string, status: "open" | "resolved"): Promise<FeedbackResult> {
  const parsed = reportStatusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  if (!(await getStaffRole())) return { ok: false, message: NOT_REVIEWER };
  const supabase = await createSupabaseServerClient();
  return saved(await supabase.from("problem_reports").update({ status: parsed.data.status }).eq("id", parsed.data.id).select("id"));
}

export async function setTakedownStatus(id: string, status: "open" | "done"): Promise<FeedbackResult> {
  const parsed = takedownStatusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  if (!(await getStaffRole())) return { ok: false, message: NOT_REVIEWER };
  const supabase = await createSupabaseServerClient();
  return saved(await supabase.from("takedown_requests").update({ status: parsed.data.status }).eq("id", parsed.data.id).select("id"));
}

function saved({ data, error }: { data: { id: string }[] | null; error: { code?: string } | null }): FeedbackResult {
  if (error) {
    logFailure("setStatus", error.code);
    return { ok: false, message: "That wasn’t saved. Please try again." };
  }
  if (!data || data.length === 0) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true };
}
