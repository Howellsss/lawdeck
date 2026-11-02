import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { questionsLeft, type Allowance } from "@/lib/allowance";
import type { Database } from "@/server/db/types";
import { claimPilotInvite } from "@/server/pilot/invite";

// The signed-in person's question allowance this month, or null if it could not be read.
// Callers treat null as "do not call the AI" (limits must hold even when a check fails).
// No questions at all means invite-only and no access yet: if their email has been registered since
// they signed in, they get access now, with no invite link needed (founder, 2026-11-02).
export async function getAllowance(
  db: SupabaseClient<Database>,
): Promise<Allowance | null> {
  const allowance = await readAllowance(db);
  if (!allowance || allowance.unlimited || allowance.limit !== 0) return allowance;
  return (await claimPilotInvite(db)) === "ok" ? readAllowance(db) : allowance;
}

async function readAllowance(db: SupabaseClient<Database>): Promise<Allowance | null> {
  const { data, error } = await db.rpc("question_allowance");
  if (error || !data?.[0]) {
    console.error("allowance check failed", { code: error?.code ?? "no_row" });
    return null;
  }
  const row = data[0];
  // == null also covers a database without migration 35 (no window columns yet).
  const window =
    row.window_limit == null ? null : { used: row.window_used ?? 0, limit: row.window_limit, resetsAt: row.window_resets_at };
  return { used: row.used, limit: row.monthly_limit, unlimited: row.unlimited, window };
}

// Questions left this month and, during a public test, in the current short window.
export function hasQuestionsLeft(a: Allowance): boolean {
  return a.unlimited || (questionsLeft(a) ?? 0) > 0;
}

export const ALLOWANCE_UNAVAILABLE =
  "Lawdeck couldn’t check your questions left this month. Please try again in a moment.";
