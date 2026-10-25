import "server-only";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import type { ReportCategory, ReportTarget } from "@/schemas/feedback";
import { WorkspaceLoadError } from "./workspace";

// Reads for the review team's Reports and Takedowns pages (step 6f). Only reviewers and admins
// get anything; the database's row-level security enforces the same.

export type ReportView = {
  id: string;
  kind: ReportTarget;
  // The reported answer, document, brief or practice question (answers can be traced by admins).
  targetId: string;
  category: ReportCategory;
  note: string | null;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  // What was reported (title and text), or null if it has since been deleted.
  context: { title: string; body: string } | null;
};
export type TakedownView = {
  id: string;
  name: string;
  email: string;
  material: string;
  reason: string;
  status: "open" | "done";
  createdAt: string;
  doneAt: string | null;
};

function failed(what: string, code: string | undefined): never {
  console.error("feedback read failed", { what, code: code ?? "unknown" });
  throw new WorkspaceLoadError(what);
}

// Open reports first, then the most recent resolved ones. Null for anyone who is not staff.
export async function listReports(): Promise<ReportView[] | null> {
  if (!(await getStaffRole())) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("problem_reports")
    .select("id, target_kind, target_id, category, note, status, created_at, resolved_at")
    .order("status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) failed("reports", error.code);
  return Promise.all(
    data.map(async (r) => {
      const context = await supabase.rpc("problem_report_context", { report: r.id });
      return {
        id: r.id,
        kind: r.target_kind,
        targetId: r.target_id,
        category: r.category,
        note: r.note,
        status: r.status,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        context: context.data?.[0] ?? null,
      };
    }),
  );
}

// Open requests first (oldest first, as they are due soonest), then recent closed ones.
export async function listTakedowns(): Promise<TakedownView[] | null> {
  if (!(await getStaffRole())) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("takedown_requests")
    .select("id, name, email, material, reason, status, created_at, done_at")
    .order("status", { ascending: false })
    .order("created_at")
    .limit(200);
  if (error) failed("takedown requests", error.code);
  return data.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    material: t.material,
    reason: t.reason,
    status: t.status,
    createdAt: t.created_at,
    doneAt: t.done_at,
  }));
}
