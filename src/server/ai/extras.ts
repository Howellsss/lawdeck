import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ExplainPassage } from "@/prompts/explain";
import { EXTRAS_PROMPT_VERSION, EXTRAS_SCHEMA, EXTRAS_SYSTEM, extrasRequest, type ExtrasLesson } from "@/prompts/extras";
import { tidyExtrasJson } from "@/lib/replySalvage";
import { extrasAidSchema, extrasReplySchema, extrasStorySchema, type ExtrasReply } from "@/schemas/extras";
import { failureDetails, getClaude, isCreditError, isTimeout, MissingKeyError } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";

// Shorter than a lesson (a few aids and stories), but still Opus: inside the route's 5 minutes.
const EXTRAS_TIMEOUT_MS = 240_000;

export type ExtrasResult =
  | { ok: true; reply: ExtrasReply; model: string; costUsd: number | null; ms: number }
  | { ok: false; reason: "no_key" | "no_credit" | "busy" | "timeout" | "refused" | "unavailable" | "too_long" | "malformed" };

// Memory aids and stories for one lesson, from the lesson and its library passages. Logs model,
// tokens, cost and time (rule G-08), never the lesson, passages or reply.
export async function writeExtras(lesson: ExtrasLesson, passages: ExplainPassage[]): Promise<ExtrasResult> {
  const started = Date.now();
  try {
    const stream = getClaude().messages.stream(
      {
        model: MODELS.lessons,
        max_tokens: 12_000,
        output_config: { effort: "medium", format: { type: "json_schema", schema: EXTRAS_SCHEMA } },
        system: EXTRAS_SYSTEM,
        messages: [{ role: "user", content: extrasRequest(lesson, passages) }],
      },
      { timeout: EXTRAS_TIMEOUT_MS, maxRetries: 0 },
    );
    const message = await stream.finalMessage();
    const cost = costUsd(message.model, message.usage);
    console.info("ai call", {
      job: "lesson_extras",
      prompt: EXTRAS_PROMPT_VERSION,
      model: message.model,
      tokensIn: message.usage.input_tokens,
      tokensOut: message.usage.output_tokens,
      costUsd: cost,
      ms: Date.now() - started,
      stop: message.stop_reason,
    });
    if (message.stop_reason === "refusal") return { ok: false, reason: "refused" };
    if (message.stop_reason === "max_tokens") return { ok: false, reason: "too_long" };
    const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const reply = parseExtrasReply(text);
    if (!reply) {
      console.warn("extras reply malformed", { stop: message.stop_reason });
      return { ok: false, reason: "malformed" };
    }
    return { ok: true, reply, model: message.model, costUsd: cost, ms: Date.now() - started };
  } catch (error) {
    console.error("ai call failed", { job: "lesson_extras", ...failureDetails(error), ms: Date.now() - started });
    if (error instanceof MissingKeyError) return { ok: false, reason: "no_key" };
    if (isCreditError(error)) return { ok: false, reason: "no_credit" };
    if (isTimeout(error)) return { ok: false, reason: "timeout" };
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) return { ok: false, reason: "busy" };
    return { ok: false, reason: "unavailable" };
  }
}

export function parseExtrasReply(text: string): ExtrasReply | null {
  try {
    const parsed = extrasReplySchema.safeParse(tidyExtrasJson(JSON.parse(text), { aid: extrasAidSchema, story: extrasStorySchema }));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
