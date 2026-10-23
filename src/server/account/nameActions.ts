"use server";

import { refresh } from "next/cache";
import { ownNameSchema } from "@/schemas/profile";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Saves "Your name" from the Account page (used only for the greeting). Sign-in and input are
// checked here; the database lets people change only their own profile. Never logs the name.

export type NameState = { status: "idle" | "error" | "saved"; message?: string; name?: string };

export async function saveOwnName(_prev: NameState, formData: FormData): Promise<NameState> {
  const value = formData.get("name");
  const typed = typeof value === "string" ? value.slice(0, 200) : "";
  const parsed = ownNameSchema.safeParse({ name: typed });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message, name: typed };
  const account = await getCurrentAccount();
  if (!account) return { status: "error", message: "Please sign in again, then try once more.", name: typed };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.name || null })
    .eq("id", account.id);
  if (error) {
    console.error("name save failed", { code: error.code ?? "unknown" });
    return { status: "error", message: "Your name wasn’t saved. Please try again.", name: typed };
  }
  refresh();
  return { status: "saved", name: parsed.data.name };
}
