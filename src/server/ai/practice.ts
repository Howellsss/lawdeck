import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ExplainPassage } from "@/prompts/explain";
import { PRACTICE_PROMPT_VERSION, PRACTICE_SCHEMA, PRACTICE_SYSTEM, practiceRequest, type PracticeQuestionKind } from "@/prompts/practice";
import { practiceReplySchema, type PracticeReply } from "@/schemas/practice";
import { failureDetails, getClaude, MissingKeyError } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";

// A set of up to 10 questions with model answers takes longer to write than one explanation, so
// this call has its own time limit (rule G-10: every call is time-limited).
const PRACTICE_TIMEOUT_MS = 120_000;
// Malformed replies are retried once, then reported (rule F-03).
const ATTEMPTS = 2;

export type PracticeResult =
  | { ok: true; reply: PracticeReply; model: string; costUsd: number | null; usage: { tokensIn: number; tokensOut: number; ms: number } }
  | { ok: false; reason: "no_key" | "busy" | "refused" | "unavailable" | "malformed" };

// Asks Claude for practice questions from the supplied passages, in a fixed structure that is
// checked before use. Logs model, tokens, cost and time (rule G-08), never the passages or questions.
// The caller records usage once the set is saved, so a set that could not be made is free.
export async function makePracticeQuestions(input: {
  passages: ExplainPassage[];
  topic: string;
  kind: PracticeQuestionKind;
  count: number;
  userId: string;
}): Promise<PracticeResult> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const result = await callOnce(input, attempt);
    if (result.ok || result.reason !== "malformed") return result;
  }
  return { ok: false, reason: "malformed" };
}

async function callOnce(
  input: { passages: ExplainPassage[]; topic: string; kind: PracticeQuestionKind; count: number; userId: string },
  attempt: number,
): Promise<PracticeResult> {
  const started = Date.now();
  try {
    const stream = getClaude().messages.stream(
      {
        model: input.kind === "flashcards" ? MODELS.flashcards : MODELS.practice,
        max_tokens: 16_000,
        // Flashcards are short facts: Haiku with no long thinking. Questions get Sonnet at medium effort.
        ...(input.kind === "flashcards" ? { thinking: { type: "disabled" as const } } : {}),
        output_config: {
          effort: input.kind === "flashcards" ? "low" : "medium",
          format: { type: "json_schema", schema: PRACTICE_SCHEMA },
        },
        system: [{ type: "text", text: PRACTICE_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: practiceRequest(input) }],
      },
      { timeout: PRACTICE_TIMEOUT_MS },
    );
    const message = await stream.finalMessage();
    const cost = costUsd(message.model, message.usage);
    const tokensIn =
      message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0);
    console.info("ai call", {
      job: "practice",
      prompt: PRACTICE_PROMPT_VERSION,
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
    const reply = parseReply(text);
    if (!reply) {
      console.warn("practice reply malformed", { attempt, stop: message.stop_reason });
      return { ok: false, reason: "malformed" };
    }
    return {
      ok: true,
      reply,
      model: message.model,
      costUsd: cost,
      usage: { tokensIn, tokensOut: message.usage.output_tokens, ms: Date.now() - started },
    };
  } catch (error) {
    console.error("ai call failed", { job: "practice", userId: input.userId, ...failureDetails(error), ms: Date.now() - started });
    if (error instanceof MissingKeyError) return { ok: false, reason: "no_key" };
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) return { ok: false, reason: "busy" };
    return { ok: false, reason: "unavailable" };
  }
}

export function parseReply(text: string): PracticeReply | null {
  try {
    const parsed = practiceReplySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
