import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import type { Database } from "@/server/db/types";

// The invite link (migration 36): gives a registered person access when they sign in with Google.
// "error" means the database could not be asked (for example before migration 36 is in).
export type InviteClaim = "open" | "ok" | "use_google" | "not_registered" | "error";

export async function claimPilotInvite(db?: SupabaseClient<Database>): Promise<InviteClaim> {
  const supabase = db ?? (await createSupabaseServerClient());
  const { data, error } = await supabase.rpc("claim_pilot_invite");
  if (error || !data) {
    // The error code only, never the email (rule I-03).
    console.error("invite claim failed", { code: error?.code ?? "no_result" });
    return "error";
  }
  return data;
}
