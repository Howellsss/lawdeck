import "server-only";
// ADMIN JOB: uses the service-role key (src/server/db/admin.ts) to write search vectors,
// which no signed-in person may write (System Design §4). Callers check the admin role first.
import { createAdminClient } from "@/server/db/admin";
import { batchByTokens, EMBED_BATCH, embedWithRetry, toVectorText } from "./voyage";
import { EMBEDDING_MODEL } from "./settings";

// Stop starting new batches after this long, so one step ends inside the page's time limit.
const STEP_BUDGET_MS = 120_000;

export type IndexStepResult =
  | { ok: true; done: boolean; indexed: number; total: number }
  | { ok: false; message: string };

const MESSAGES = {
  no_key: "Search is not set up yet: the Voyage AI key is missing on the server.",
  busy:
    "Voyage AI kept saying it is busy for over two minutes. Its free limits are very low until a payment method is added in the Voyage dashboard; then use “Index for search” to carry on.",
  refused: "Voyage AI did not accept the request. Check the key and the account's credit.",
  unavailable: "Voyage AI could not be reached. Try again in a few minutes.",
} as const;

// The text a passage is searched by: its heading, then its wording.
export function passageSearchText(heading: string | null, text: string): string {
  return heading ? `${heading}\n\n${text}` : text;
}

// Gives an item's passages search vectors, as many as fit in one request. The screen calls it
// again until it is done. Passages that already have vectors from the current model are skipped.
export async function indexStep(itemId: string): Promise<IndexStepResult> {
  const db = createAdminClient();
  if (!db) return { ok: false, message: "Search is not set up yet: the server's admin key is missing." };
  const started = Date.now();
  const deadline = started + STEP_BUDGET_MS;
  let progressed = false;

  while (Date.now() < deadline) {
    const { data: loaded, error } = await db
      .from("kb_passages")
      .select("id, heading, text")
      .eq("item_id", itemId)
      .or(`embedding_model.is.null,embedding_model.neq.${EMBEDDING_MODEL}`)
      .order("position")
      .limit(EMBED_BATCH);
    if (error) return failed("load", error.code);
    if (loaded.length === 0) break;

    // Only as many passages as fit Voyage's per-minute token allowance in one call.
    const texts = loaded.map((passage) => passageSearchText(passage.heading, passage.text));
    const size = batchByTokens(texts)[0].length;
    const batch = loaded.slice(0, size);
    const result = await embedWithRetry(texts.slice(0, size), "document", EMBEDDING_MODEL, "index", deadline);
    if (!result.ok) {
      // Busy until the end of this step: report progress and let the screen carry on,
      // unless nothing at all got through in this step.
      if (result.reason === "busy" && progressed) break;
      return { ok: false, message: MESSAGES[result.reason] };
    }
    const saved = await Promise.all(
      batch.map((passage, index) =>
        db
          .from("kb_passages")
          .update({ embedding: toVectorText(result.vectors[index]), embedding_model: EMBEDDING_MODEL })
          .eq("id", passage.id),
      ),
    );
    const failure = saved.find((row) => row.error);
    if (failure?.error) return failed("save", failure.error.code);
    progressed = true;
  }

  const [total, indexed] = await Promise.all([
    db.from("kb_passages").select("id", { count: "exact", head: true }).eq("item_id", itemId),
    db
      .from("kb_passages")
      .select("id", { count: "exact", head: true })
      .eq("item_id", itemId)
      .eq("embedding_model", EMBEDDING_MODEL),
  ]);
  if (total.error || indexed.error) return failed("count", total.error?.code ?? indexed.error?.code);
  const done = (indexed.count ?? 0) === (total.count ?? 0);
  const updated = await db
    .from("kb_items")
    .update({
      indexed_passages: indexed.count ?? 0,
      index_model: EMBEDDING_MODEL,
      indexed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (updated.error) return failed("record", updated.error.code);
  return { ok: true, done, indexed: indexed.count ?? 0, total: total.count ?? 0 };
}

// Logs the step and error code only, never passage text (rule I-03).
function failed(step: string, code: string | undefined): IndexStepResult {
  console.error("library indexing failed", { step, code: code ?? "unknown" });
  return { ok: false, message: "Indexing for search stopped. Please try again." };
}
