"use server";

import { refresh } from "next/cache";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/fieldErrors";
import { deleteChatSchema, moveChatSchema, renameChatSchema } from "@/schemas/chats";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// The chat menu (⋯): rename, move to a project, delete. Row-level security lets a student
// change only their own chats, and the database refuses a move into someone else's project.

export type ChatMenuState = {
  status: "idle" | "error" | "saved" | "deleted";
  message?: string;
  fieldErrors?: FieldErrors;
  // Echoed back so the form keeps what the student typed.
  title?: string;
};

const SIGNED_OUT: ChatMenuState = { status: "error", message: "Please sign in again, then try once more." };
const NOT_FOUND = "That chat no longer exists. It may have been deleted.";

// Logs the action and the database error code only (rule I-03).
function logFailure(action: string, code: string | undefined) {
  console.error("chat action failed", { action, code: code ?? "unknown" });
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, 1000) : "";
}

export async function renameChat(_prev: ChatMenuState, formData: FormData): Promise<ChatMenuState> {
  const title = text(formData, "title");
  const parsed = renameChatSchema.safeParse({ id: text(formData, "id"), title });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), title };
  if (!(await getCurrentAccount())) return { ...SIGNED_OUT, title };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .update({ title: parsed.data.title })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) {
    logFailure("renameChat", error.code);
    return { status: "error", message: "The new name wasn’t saved. Please try again.", title };
  }
  // Row-level security hides other students' chats, so "no rows" means not found.
  if (data.length === 0) return { status: "error", message: NOT_FOUND, title };
  refresh();
  return { status: "saved", title: parsed.data.title };
}

export async function moveChat(_prev: ChatMenuState, formData: FormData): Promise<ChatMenuState> {
  const parsed = moveChatSchema.safeParse({ id: text(formData, "id"), projectId: text(formData, "projectId") });
  if (!parsed.success) return { status: "error", message: "Choose a project from the list." };
  if (!(await getCurrentAccount())) return SIGNED_OUT;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .update({ project_id: parsed.data.projectId })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) {
    logFailure("moveChat", error.code);
    // 23503: the project is gone, or is not the student's own.
    const message =
      error.code === "23503"
        ? "That project no longer exists. Choose another one."
        : "The chat wasn’t moved. Please try again.";
    return { status: "error", message };
  }
  if (data.length === 0) return { status: "error", message: NOT_FOUND };
  refresh();
  return { status: "saved" };
}

export async function deleteChat(_prev: ChatMenuState, formData: FormData): Promise<ChatMenuState> {
  const parsed = deleteChatSchema.safeParse({ id: text(formData, "id") });
  if (!parsed.success) return { status: "error", message: NOT_FOUND };
  if (!(await getCurrentAccount())) return SIGNED_OUT;

  const supabase = await createSupabaseServerClient();
  // Its messages go with it (on delete cascade, migration 2).
  const { data, error } = await supabase.from("conversations").delete().eq("id", parsed.data.id).select("id");
  if (error) {
    logFailure("deleteChat", error.code);
    return { status: "error", message: "The chat wasn’t deleted. Please try again." };
  }
  if (data.length === 0) return { status: "error", message: NOT_FOUND };
  refresh();
  return { status: "deleted" };
}
