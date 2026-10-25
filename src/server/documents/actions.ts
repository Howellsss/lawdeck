"use server";

import {
  draftingIdSchema,
  draftingStatusSchema,
  describeIssues,
  forumProfileSchema,
  templateSpecSchema,
} from "@/schemas/drafting";
import { z } from "@/lib/zod";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { FORUM_FILES, TEMPLATE_FILES } from "@/templates";
import { loadDraftingFiles, type LoadReport } from "./load";

// Reviewer actions on courts, registries and templates (step 5b). Reviewers and admins only,
// checked here on the server; row-level security enforces the same in the database (migration 21).
// Nothing is approved without passing the schema checks first (rule H-03).

export type DraftingActionResult =
  | { ok: true }
  | { ok: false; message: string; issues?: string[] };
export type LoadResult =
  | { ok: true; report: LoadReport }
  | { ok: false; message: string };

const NOT_STAFF = "Only reviewers and admins can change templates.";

export async function loadTemplateFiles(): Promise<LoadResult> {
  if (!(await getStaffRole())) return { ok: false, message: NOT_STAFF };
  const supabase = await createSupabaseServerClient();
  return {
    ok: true,
    report: await loadDraftingFiles(supabase, FORUM_FILES, TEMPLATE_FILES),
  };
}

export async function setForumStatus(
  id: string,
  status: string,
): Promise<DraftingActionResult> {
  const parsedId = draftingIdSchema.safeParse(id);
  const parsedStatus = draftingStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success)
    return { ok: false, message: "That court or registry could not be found." };
  if (!(await getStaffRole())) return { ok: false, message: NOT_STAFF };
  const supabase = await createSupabaseServerClient();
  if (parsedStatus.data === "approved") {
    const { data, error } = await supabase
      .from("forums")
      .select("profile")
      .eq("id", parsedId.data)
      .maybeSingle();
    if (error || !data)
      return failure(
        "forum read",
        error?.code,
        "That court or registry could not be found.",
      );
    const checked = forumProfileSchema.safeParse(data.profile);
    if (!checked.success)
      return {
        ok: false,
        message: "Fix the formatting profile before approving.",
        issues: describeIssues(checked.error),
      };
  }
  const { data, error } = await supabase
    .from("forums")
    .update({ status: parsedStatus.data })
    .eq("id", parsedId.data)
    .select("id");
  if (error || !data?.length)
    return failure(
      "forum status",
      error?.code,
      "The status was not changed. Please try again.",
    );
  return { ok: true };
}

export async function setTemplateStatus(
  id: string,
  status: string,
): Promise<DraftingActionResult> {
  const parsedId = draftingIdSchema.safeParse(id);
  const parsedStatus = draftingStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success)
    return { ok: false, message: "That template could not be found." };
  if (!(await getStaffRole())) return { ok: false, message: NOT_STAFF };
  const supabase = await createSupabaseServerClient();
  if (parsedStatus.data === "approved") {
    const { data, error } = await supabase
      .from("templates")
      .select("spec, rule_source")
      .eq("id", parsedId.data)
      .maybeSingle();
    if (error || !data)
      return failure(
        "template read",
        error?.code,
        "That template could not be found.",
      );
    const checked = templateSpecSchema.safeParse(data.spec);
    if (!checked.success)
      return {
        ok: false,
        message: "Fix the template before approving.",
        issues: describeIssues(checked.error),
      };
    if (!data.rule_source)
      return {
        ok: false,
        message:
          "Add the rule, form or statute the template follows before approving.",
      };
  }
  const { data, error } = await supabase
    .from("templates")
    .update({ status: parsedStatus.data })
    .eq("id", parsedId.data)
    .select("id");
  if (error || !data?.length)
    return failure(
      "template status",
      error?.code,
      "The status was not changed. Please try again.",
    );
  return { ok: true };
}

export type BulkApproveResult =
  | {
      ok: true;
      approved: number;
      failed: { id: string; message: string; issues?: string[] }[];
    }
  | { ok: false; message: string };

const bulkIdsSchema = z.array(draftingIdSchema).min(1).max(200);

// Approve several templates at once (founder, 2026-10-25). Each one goes through exactly the
// same checks as approving it on its own page; the ones that fail are listed with the reason.
export async function approveTemplates(
  ids: string[],
): Promise<BulkApproveResult> {
  const parsed = bulkIdsSchema.safeParse(ids);
  if (!parsed.success)
    return { ok: false, message: "Tick at least one template to approve." };
  if (!(await getStaffRole())) return { ok: false, message: NOT_STAFF };
  let approved = 0;
  const failed: { id: string; message: string; issues?: string[] }[] = [];
  for (const id of new Set(parsed.data)) {
    const result = await setTemplateStatus(id, "approved");
    if (result.ok) approved += 1;
    else failed.push({ id, message: result.message, issues: result.issues });
  }
  return { ok: true, approved, failed };
}

export async function deleteDraftingItem(
  kind: "forum" | "template",
  id: string,
): Promise<DraftingActionResult> {
  if (
    !draftingIdSchema.safeParse(id).success ||
    (kind !== "forum" && kind !== "template")
  )
    return { ok: false, message: "That item could not be found." };
  if ((await getStaffRole()) !== "admin")
    return {
      ok: false,
      message: "Only admins can delete templates, courts and registries.",
    };
  const supabase = await createSupabaseServerClient();
  const table = kind === "forum" ? "forums" : "templates";
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data?.length)
    return failure(
      `${kind} delete`,
      error?.code,
      "It was not deleted. Please try again.",
    );
  return { ok: true };
}

function failure(
  action: string,
  code: string | undefined,
  message: string,
): DraftingActionResult {
  console.error("drafting action failed", { action, code: code ?? "no_row" });
  return { ok: false, message };
}
