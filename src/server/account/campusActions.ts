"use server";

import { refresh } from "next/cache";
import { campusSchema } from "@/schemas/profile";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Saves "Your campus" (home page prompt and Account page). Sign-in and input are checked here; the
// database accepts only a campus on its list and only the student's own profile.

export type CampusState = { status: "idle" | "error" | "saved"; message?: string; campus?: string };

export async function saveCampus(_prev: CampusState, formData: FormData): Promise<CampusState> {
  const value = formData.get("campus");
  const parsed = campusSchema.safeParse({ campus: typeof value === "string" ? value.slice(0, 60) : "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const account = await getCurrentAccount();
  if (!account) return { status: "error", message: "Please sign in again, then try once more." };

  const db = await createSupabaseServerClient();
  const { error } = await db
    .from("profiles")
    .update({ campus: parsed.data.campus || null })
    .eq("id", account.id);
  if (error) {
    console.error("campus save failed", { code: error.code ?? "unknown" });
    return {
      status: "error",
      message: error.code === "23503" ? "Choose a campus from the list." : "Your campus wasn’t saved. Please try again.",
      campus: parsed.data.campus,
    };
  }
  refresh();
  return { status: "saved", campus: parsed.data.campus };
}
