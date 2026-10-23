import "server-only";
import { firstName } from "@/lib/greeting";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";

// The signed-in person's name for the greeting and the Account page. Shown only to them, and
// never sent to the AI (CLAUDE.md, AI rules).

// The name they typed on the Account page, if any.
export async function getOwnName(): Promise<string | null> {
  const account = await getCurrentAccount();
  if (!account) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("profiles").select("full_name").eq("id", account.id).maybeSingle();
  if (error) {
    console.error("profile read failed", { code: error.code ?? "unknown" });
    return null;
  }
  return data?.full_name?.trim() || null;
}

// First name for "Good morning, …": the Account page name, else the name Google gave at sign-in.
export async function getGreetingName(): Promise<string | null> {
  const own = await getOwnName();
  if (own) return firstName(own);
  const account = await getCurrentAccount();
  if (!account) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const meta = data?.claims?.user_metadata;
  const fromGoogle =
    meta && typeof meta === "object"
      ? [(meta as Record<string, unknown>).full_name, (meta as Record<string, unknown>).name].find((v) => typeof v === "string")
      : undefined;
  return firstName(typeof fromGoogle === "string" ? fromGoogle : null);
}
