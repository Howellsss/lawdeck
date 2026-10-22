import "server-only";
import { createSupabaseServerClient } from "@/server/auth/supabase";

export type UsageKind = "explain" | "route" | "transcribe";

// Saves one AI call to usage_events for the signed-in person (rules G-08, K-01): model, tokens,
// cost and time, never the question or the answer. The database takes the owner from the
// sign-in. A failure here is logged and never stops the student's answer.
export async function recordUsage(entry: {
  kind: UsageKind;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null;
  ms: number;
}): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("record_ai_usage", {
      kind: entry.kind,
      model: entry.model,
      tokens_in: Math.round(entry.tokensIn),
      tokens_out: Math.round(entry.tokensOut),
      cost_usd: entry.costUsd ?? 0,
      duration_ms: Math.round(entry.ms),
    });
    if (error) console.error("usage record failed", { kind: entry.kind, code: error.code });
  } catch (error) {
    // Outside a signed-in request (for example the routing test on GitHub) there is no one to record.
    console.warn("usage record skipped", { kind: entry.kind, name: (error as Error)?.name });
  }
}
