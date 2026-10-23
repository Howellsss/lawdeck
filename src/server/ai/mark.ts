import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ExplainPassage } from "@/prompts/explain";
import { MARKING_PROMPT_VERSION, MARKING_SCHEMA, MARKING_SYSTEM, markingRequest } from "@/prompts/marking";
import { markingReplySchema, type MarkingReply } from "@/schemas/marking";
import { failureDetails, getClaude, MissingKeyError } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";

const MARKING_TIMEOUT_MS = 120_000; // rule G-10: every call is time-limited
const ATTEMPTS = 2; // a malformed reply is retried once, then reported (rule F-03)

export type MarkResult =
  | { ok: true; reply: MarkingReply; model: string; costUsd: number | null; usage: { tokensIn: number; tokensOut: number; ms: number } }
  | { ok: false; reason: "no_key" | "busy" | "refused" | "unavailable" | "malformed" };

type MarkInput = {
  passages: ExplainPassage[];
  question: string;
  criteria: { point: string; marks: number }[];
  answer: string;
  userId: string;
};

// Marks one answer against an approved guide (Opus, as CLAUDE.md sets for marking). Logs model,
// tokens, cost and time (rule G-08), never the answer or the marking. The caller records usage
// once the marked answer is saved, so marking that fails is free.
export async function markWithClaude(input: MarkInput): Promise<MarkResult> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const result = await callOnce(input, attempt);
    if (result.ok || result.reason !== "malformed") return result;
  }
  return { ok: false, reason: "malformed" };
}

async function callOnce(input: MarkInput, attempt: number): Promise<MarkResult> {
  const started = Date.now();
  try {
    const stream = getClaude().messages.stream(
      {
        model: MODELS.marking,
        max_tokens: 12_000,
        output_config: { effort: "medium", format: { type: "json_schema", schema: MARKING_SCHEMA } },
        system: [{ type: "text", text: MARKING_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: markingRequest(input) }],
      },
      { timeout: MARKING_TIMEOUT_MS },
    );
    const message = await stream.finalMessage();
    const cost = costUsd(message.model, message.usage);
    const tokensIn =
      message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0);
    console.info("ai call", {
      job: "marking",
      prompt: MARKING_PROMPT_VERSION,
      userId: input.userId,
      model: message.model,
      tokensIn,
      tokensOut: message.usage.output_tokens,
      costUsd: cost,
      ms: Date.now() - started,
      stop: message.stop_reason,
      attempt,
    });
    if (message.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const reply = parseMarkingReply(text);
    if (!reply) {
      console.warn("marking reply malformed", { attempt, stop: message.stop_reason });
      return { ok: false, reason: "malformed" };
    }
    return { ok: true, reply, model: message.model, costUsd: cost, usage: { tokensIn, tokensOut: message.usage.output_tokens, ms: Date.now() - started } };
  } catch (error) {
    console.error("ai call failed", { job: "marking", userId: input.userId, ...failureDetails(error), ms: Date.now() - started });
    if (error instanceof MissingKeyError) return { ok: false, reason: "no_key" };
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) return { ok: false, reason: "busy" };
    return { ok: false, reason: "unavailable" };
  }
}

export function parseMarkingReply(text: string): MarkingReply | null {
  try {
    const parsed = markingReplySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
