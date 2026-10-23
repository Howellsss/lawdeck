import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DRAFT_PROMPT_VERSION, DRAFT_SCHEMA, DRAFT_SYSTEM, draftRequest, type DraftFact, type DraftPart } from "@/prompts/draft";
import { failureDetails, getClaude, MissingKeyError } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";

// PRD DR-02: a document within 30 seconds, so Opus thinks briefly and the call is cut off at 60.
const DRAFT_TIMEOUT_MS = 60_000; // rule G-10: every call is time-limited
const ATTEMPTS = 2; // a malformed reply is retried once, then reported (rule F-03)

const draftReplySchema = z.object({
  parts: z.array(z.object({ id: z.string().max(60), text: z.string().max(20_000) })).max(80),
});
export type DraftReply = z.infer<typeof draftReplySchema>;

export type DraftResult =
  | { ok: true; reply: DraftReply; model: string; costUsd: number | null; usage: { tokensIn: number; tokensOut: number; ms: number } }
  | { ok: false; reason: "no_key" | "busy" | "refused" | "unavailable" | "malformed" };

type DraftInput = {
  documentTitle: string;
  forumName: string | null;
  outline: { id: string; heading: string | null; kind: string }[];
  parts: DraftPart[];
  facts: DraftFact[];
  userId: string;
};

// Writes a document's narrative parts with Opus (CLAUDE.md: Opus for documents). Names and
// addresses never reach Claude: they arrive as stand-ins. Logs model, tokens, cost and time
// (rule G-08), never the facts or the text. The caller records usage once the draft is saved, so
// a draft that fails is free.
export async function writeDraftParts(input: DraftInput): Promise<DraftResult> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const result = await callOnce(input, attempt);
    if (result.ok || result.reason !== "malformed") return result;
  }
  return { ok: false, reason: "malformed" };
}

async function callOnce(input: DraftInput, attempt: number): Promise<DraftResult> {
  const started = Date.now();
  try {
    const stream = getClaude().messages.stream(
      {
        model: MODELS.documents,
        max_tokens: 16_000,
        output_config: { effort: "low", format: { type: "json_schema", schema: DRAFT_SCHEMA } },
        system: [{ type: "text", text: DRAFT_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: draftRequest(input) }],
      },
      { timeout: DRAFT_TIMEOUT_MS },
    );
    const message = await stream.finalMessage();
    const cost = costUsd(message.model, message.usage);
    const tokensIn =
      message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0);
    console.info("ai call", {
      job: "draft",
      prompt: DRAFT_PROMPT_VERSION,
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
    const reply = parseDraftReply(text);
    if (!reply) {
      console.warn("draft reply malformed", { attempt, stop: message.stop_reason });
      return { ok: false, reason: "malformed" };
    }
    return { ok: true, reply, model: message.model, costUsd: cost, usage: { tokensIn, tokensOut: message.usage.output_tokens, ms: Date.now() - started } };
  } catch (error) {
    console.error("ai call failed", { job: "draft", userId: input.userId, ...failureDetails(error), ms: Date.now() - started });
    if (error instanceof MissingKeyError) return { ok: false, reason: "no_key" };
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) return { ok: false, reason: "busy" };
    return { ok: false, reason: "unavailable" };
  }
}

export function parseDraftReply(text: string): DraftReply | null {
  try {
    const parsed = draftReplySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
