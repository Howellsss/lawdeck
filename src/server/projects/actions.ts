"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { createProjectSchema, deleteProjectSchema, renameProjectSchema } from "@/schemas/projects";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export type ProjectFormState = {
  status: "idle" | "error" | "saved";
  message?: string;
  fieldErrors?: FieldErrors;
  // Echoed back so the form keeps what the student typed.
  name?: string;
};

const SIGNED_OUT: ProjectFormState = { status: "error", message: "Please sign in again, then try once more." };
const SAVE_FAILED = "Your change wasn’t saved. Please try again.";
const NOT_FOUND = "That project no longer exists. It may have been deleted.";

// Logs the action and the database error code only (rule I-03).
function logFailure(action: string, code: string | undefined) {
  console.error("project action failed", { action, code: code ?? "unknown" });
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, 1000) : "";
}

export async function createProject(_prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const name = text(formData, "name");
  const parsed = createProjectSchema.safeParse({ name });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), name };
  if (!(await getCurrentAccount())) return { ...SIGNED_OUT, name };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("projects").insert({ name: parsed.data.name }).select("id").single();
  if (error) {
    logFailure("createProject", error.code);
    return { status: "error", message: SAVE_FAILED, name };
  }
  redirect(`/projects/${data.id}`);
}

export async function renameProject(_prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const name = text(formData, "name");
  const parsed = renameProjectSchema.safeParse({ id: text(formData, "id"), name });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), name };
  if (!(await getCurrentAccount())) return { ...SIGNED_OUT, name };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) {
    logFailure("renameProject", error.code);
    return { status: "error", message: SAVE_FAILED, name };
  }
  // Row-level security hides other students' projects, so "no rows" means not found.
  if (data.length === 0) return { status: "error", message: NOT_FOUND, name };
  refresh();
  return { status: "saved", name: parsed.data.name };
}

export async function deleteProject(_prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const parsed = deleteProjectSchema.safeParse({ id: text(formData, "id") });
  if (!parsed.success) return { status: "error", message: NOT_FOUND };
  if (!(await getCurrentAccount())) return SIGNED_OUT;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("projects").delete().eq("id", parsed.data.id).select("id");
  if (error) {
    logFailure("deleteProject", error.code);
    return { status: "error", message: "The project wasn’t deleted. Please try again." };
  }
  if (data.length === 0) return { status: "error", message: NOT_FOUND };
  redirect("/projects");
}
