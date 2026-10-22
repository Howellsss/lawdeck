"use server";

import { briefIdSchema, newBriefSchema } from "@/schemas/brief";
import { getCurrentAccount } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { createBrief } from "./create";

// Brief actions (Phase 4, step 4f). Input is checked with Zod and sign-in on the server; row-level
// security keeps every brief to its owner.

export type StartBriefResult = { ok: true; id: string } | { ok: false; message: string; signIn?: boolean };

export async function startBrief(input: { kind: string; name: string; course: string }): Promise<StartBriefResult> {
  const parsed = newBriefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Type the name of the case or statute." };
  const account = await getCurrentAccount();
  if (!account) return { ok: false, signIn: true, message: "Sign in to get briefs." };
  const supabase = await createSupabaseServerClient();
  return createBrief(supabase, account.id, parsed.data);
}

export async function deleteBrief(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!briefIdSchema.safeParse(id).success) return { ok: false, message: "That brief could not be found." };
  if (!(await getCurrentAccount())) return { ok: false, message: "Sign in first." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("briefs").delete().eq("id", id);
  if (error) {
    console.error("brief action failed", { action: "delete", code: error.code });
    return { ok: false, message: "The brief was not deleted. Please try again." };
  }
  return { ok: true };
}
