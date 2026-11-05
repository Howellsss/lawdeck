import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AGAIN_PROMPT_VERSION } from "@/prompts/again";
import { EXTRAS_SCHEMA } from "@/prompts/extras";
import type { ExtrasReply } from "@/schemas/extras";
import { failureDetails, getClaude, isCreditError, isTimeout, MissingKeyError } from "./client";
import { costUsd } from "./costs";
import { parseExtrasReply } from "./extras";
import { MODELS } from "./models";

// A student is waiting: a short reply, so 45 seconds at most (rule G-10).
const AGAIN_TIMEOUT_MS = 45_000;

export type AgainResult =
  | { ok: true; reply: ExtrasReply; model: string; tokensIn: number; tokensOut: number; costUsd: number | null; ms: number }
  | { ok: false; reason: "no_key" | "no_credit" | "busy" | "timeout" | "refused" | "unavailable" | "malformed" };

// "Another memory aid" or "Tell it another way" (Phase 2c), in the same shape as the reviewed
// memory aids so the same checks apply. Logs model, tokens, cost and time, never the text.
export async function writeAgain(job: "aid" | "story", system: string, request: string): Promise<AgainResult> {
  const started = Date.now();
  try {
    const message = await getClaude().messages.create(
      {
        model: MODELS.memoryAids,
        max_tokens: 4_000,
        output_config: { effort: "low", format: { type: "json_schema", schema: EXTRAS_SCHEMA } },
        system,
        messages: [{ role: "user", content: request }],
      },
      { timeout: AGAIN_TIMEOUT_MS, maxRetries: 1 },
    );
    const cost = costUsd(message.model, message.usage);
    const ms = Date.now() - started;
    console.info("ai call", {
      job: `again_${job}`,
      prompt: AGAIN_PROMPT_VERSION,
      model: message.model,
      tokensIn: message.usage.input_tokens,
      tokensOut: message.usage.output_tokens,
      costUsd: cost,
      ms,
      stop: message.stop_reason,
    });
    if (message.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const reply = parseExtrasReply(text);
    if (!reply) return { ok: false, reason: "malformed" };
    return { ok: true, reply, model: message.model, tokensIn: message.usage.input_tokens, tokensOut: message.usage.output_tokens, costUsd: cost, ms };
  } catch (error) {
    console.error("ai call failed", { job: `again_${job}`, ...failureDetails(error), ms: Date.now() - started });
    if (error instanceof MissingKeyError) return { ok: false, reason: "no_key" };
    if (isCreditError(error)) return { ok: false, reason: "no_credit" };
    if (isTimeout(error)) return { ok: false, reason: "timeout" };
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) return { ok: false, reason: "busy" };
    return { ok: false, reason: "unavailable" };
  }
}
