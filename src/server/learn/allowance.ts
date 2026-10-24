import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { questionsLeft, type Allowance } from "@/lib/allowance";
import type { Database } from "@/server/db/types";

// The signed-in person's question allowance this month, or null if it could not be read.
// Callers treat null as "do not call the AI" (limits must hold even when a check fails).
export async function getAllowance(
  db: SupabaseClient<Database>,
): Promise<Allowance | null> {
  const { data, error } = await db.rpc("question_allowance");
  if (error || !data?.[0]) {
    console.error("allowance check failed", { code: error?.code ?? "no_row" });
    return null;
  }
  const row = data[0];
  const window =
    row.window_limit === null ? null : { used: row.window_used ?? 0, limit: row.window_limit, resetsAt: row.window_resets_at };
  return { used: row.used, limit: row.monthly_limit, unlimited: row.unlimited, window };
}

// Questions left this month and, during a public test, in the current short window.
export function hasQuestionsLeft(a: Allowance): boolean {
  return a.unlimited || (questionsLeft(a) ?? 0) > 0;
}

export const ALLOWANCE_UNAVAILABLE =
  "Lawdeck couldn’t check your questions left this month. Please try again in a moment.";
