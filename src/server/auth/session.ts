import "server-only";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import { createSupabaseServerClient } from "./supabase";

export type Account = { id: string; email: string };

// The signed-in student, checked on the server, or null.
// getClaims() verifies the sign-in token; the cookie alone is never trusted.
export async function getCurrentAccount(): Promise<Account | null> {
  // Read the request first so this is always checked live, never baked into a static page.
  await cookies();
  if (!getSupabaseConfig()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    const email = typeof data.claims.email === "string" ? data.claims.email : "";
    return { id: data.claims.sub, email };
  } catch (error) {
    // If Supabase can't be reached, treat the visitor as signed out rather than breaking the page.
    console.warn("auth session check failed", { name: error instanceof Error ? error.name : "unknown" });
    return null;
  }
}
