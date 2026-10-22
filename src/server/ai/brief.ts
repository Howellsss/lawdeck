import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ExplainPassage } from "@/prompts/explain";
import { BRIEF_PROMPT_VERSION, BRIEF_SCHEMA, BRIEF_SYSTEM, briefRequest, type BriefKind } from "@/prompts/brief";
import { briefReplySchema, type BriefReply } from "@/schemas/brief";
import { failureDetails, getClaude, MissingKeyError } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";

const BRIEF_TIMEOUT_MS = 90_000; // rule G-10: every call is time-limited
const ATTEMPTS = 2; // a malformed reply is retried once, then reported (rule F-03)

export type BriefResult =
  | { ok: true; reply: BriefReply; model: string; costUsd: number | null; usage: { tokensIn: number; tokensOut: number; ms: number } }
  | { ok: false; reason: "no_key" | "busy" | "refused" | "unavailable" | "malformed" };

// Asks Claude for a brief from the supplied passages, in a fixed structure checked before use.
// Logs model, tokens, cost and time (rule G-08), never the passages or the brief. The caller
// records usage once the brief is saved, so a brief that could not be written is free.
export async function makeBrief(input: { passages: ExplainPassage[]; kind: BriefKind; name: string; userId: string }): Promise<BriefResult> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const result = await callOnce(input, attempt);
    if (result.ok || result.reason !== "malformed") return result;
  }
  return { ok: false, reason: "malformed" };
}

async function callOnce(
  input: { passages: ExplainPassage[]; kind: BriefKind; name: string; userId: string },
  attempt: number,
): Promise<BriefResult> {
  const started = Date.now();
  try {
    const stream = getClaude().messages.stream(
      {
        model: MODELS.brief,
        max_tokens: 8_000,
        output_config: { effort: "medium", format: { type: "json_schema", schema: BRIEF_SCHEMA } },
        system: [{ type: "text", text: BRIEF_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: briefRequest(input) }],
      },
      { timeout: BRIEF_TIMEOUT_MS },
    );
    const message = await stream.finalMessage();
    const cost = costUsd(message.model, message.usage);
    const tokensIn =
      message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0);
    console.info("ai call", {
      job: "brief",
      prompt: BRIEF_PROMPT_VERSION,
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
    const reply = parseBriefReply(text);
    if (!reply) {
      console.warn("brief reply malformed", { attempt, stop: message.stop_reason });
      return { ok: false, reason: "malformed" };
    }
    return { ok: true, reply, model: message.model, costUsd: cost, usage: { tokensIn, tokensOut: message.usage.output_tokens, ms: Date.now() - started } };
  } catch (error) {
    console.error("ai call failed", { job: "brief", userId: input.userId, ...failureDetails(error), ms: Date.now() - started });
    if (error instanceof MissingKeyError) return { ok: false, reason: "no_key" };
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) return { ok: false, reason: "busy" };
    return { ok: false, reason: "unavailable" };
  }
}

export function parseBriefReply(text: string): BriefReply | null {
  try {
    const parsed = briefReplySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
