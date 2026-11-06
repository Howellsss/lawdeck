import "server-only";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// Law School campuses (campus chat, Phase 1; migration 54) and the signed-in student's own choice.
export type Campus = { key: string; name: string; kind: "campus" | "aspirant" };

export async function listCampuses(): Promise<Campus[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("campuses").select("key, name, kind").order("position");
  if (error) {
    console.error("campus list failed", { code: error.code ?? "unknown" });
    return [];
  }
  return data;
}

// The student's campus key, or null when not chosen yet (or not signed in).
export async function getOwnCampus(): Promise<string | null> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("profiles").select("campus").eq("id", account.id).maybeSingle();
  if (error) {
    console.error("campus read failed", { code: error.code ?? "unknown" });
    return null;
  }
  return data?.campus ?? null;
}
