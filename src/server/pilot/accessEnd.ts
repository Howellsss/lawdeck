import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/types";

// When the signed-in person's test access ends (migration 43), or null for no end. A failed read
// gives null: the server still checks access before every answer.
export async function getOwnAccessUntil(supabase: SupabaseClient<Database>): Promise<Date | null> {
  const { data, error } = await supabase.rpc("own_access_until");
  if (error) {
    console.error("access end read failed", { code: error.code ?? "unknown" });
    return null;
  }
  return data ? new Date(data) : null;
}
