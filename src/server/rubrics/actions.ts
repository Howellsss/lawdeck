"use server";

import { rubricIdSchema, rubricSchema, rubricStatusSchema, type RubricInput } from "@/schemas/rubrics";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Marking guide actions (step 4d). Reviewers and admins only, checked here on the server;
// row-level security enforces the same in the database. The database records who approved a
// guide and when, and puts an approved guide back to draft if its wording or points change.

export type RubricActionResult = { ok: true; id: string } | { ok: false; message: string; field?: string };

const NOT_STAFF = "Only reviewers and admins can change marking guides.";

export async function saveRubric(input: RubricInput): Promise<RubricActionResult> {
  const parsed = rubricSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Check the guide.", field: issue?.path.join(".") };
  }
  if (!(await getStaffRole())) return { ok: false, message: NOT_STAFF };
  const supabase = await createSupabaseServerClient();
  const row = {
    course_id: parsed.data.courseId,
    topic_id: parsed.data.topicId,
    title: parsed.data.title,
    question: parsed.data.question,
    criteria: parsed.data.criteria,
  };
  if (parsed.data.id) {
    const { course_id: _course, ...changes } = row; // the course is fixed once a guide exists
    void _course;
    const { data, error } = await supabase.from("rubrics").update(changes).eq("id", parsed.data.id).select("id");
    if (error || !data?.length) return failure("save", error?.code, "The guide was not saved. Please try again.");
    return { ok: true, id: parsed.data.id };
  }
  const { data, error } = await supabase.from("rubrics").insert(row).select("id").single();
  if (error) return failure("create", error.code, "The guide was not saved. Please try again.");
  return { ok: true, id: data.id };
}

export async function setRubricStatus(id: string, status: string): Promise<RubricActionResult> {
  const parsedId = rubricIdSchema.safeParse(id);
  const parsedStatus = rubricStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return { ok: false, message: "That marking guide could not be found." };
  if (!(await getStaffRole())) return { ok: false, message: NOT_STAFF };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("rubrics").update({ status: parsedStatus.data }).eq("id", parsedId.data).select("id");
  if (error?.code === "23514") return { ok: false, message: "Add the question and at least one marking point before approving." };
  if (error || !data?.length) return failure("status", error?.code, "The guide was not changed. Please try again.");
  return { ok: true, id: parsedId.data };
}

export async function deleteRubric(id: string): Promise<RubricActionResult> {
  if (!rubricIdSchema.safeParse(id).success) return { ok: false, message: "That marking guide could not be found." };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: "Only admins can delete marking guides." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("rubrics").delete().eq("id", id).select("id");
  if (error || !data?.length) return failure("delete", error?.code, "The guide was not deleted. Please try again.");
  return { ok: true, id };
}

function failure(action: string, code: string | undefined, message: string): RubricActionResult {
  console.error("rubric action failed", { action, code: code ?? "no_row" });
  return { ok: false, message };
}
