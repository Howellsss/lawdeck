import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { EXPLAIN_PROMPT_VERSION, EXPLAIN_SYSTEM } from "@/prompts/explain";
import { failureDetails, getClaude, MissingKeyError } from "./client";
import { costUsd } from "./costs";
import { EXPLAIN_SETTINGS, MODELS, type ExplainModel } from "./models";
import { recordUsage } from "./usage";

export type ExplainTurn = { role: "user" | "assistant"; text: string };

// Answer length limits, in tokens (about three quarters of a word each). Problem questions get
// more room for exam-depth answers (founder, 2026-10-25); the route allows 120 seconds.
export const EXPLAIN_MAX_TOKENS = 4_000;
export const EXPLAIN_LONG_MAX_TOKENS = 7_000;
// A spoken reply in voice mode: a few sentences, so it comes back quickly.
export const EXPLAIN_TALK_MAX_TOKENS = 700;

export type ExplainResult =
  | {
      ok: true;
      model: string;
      tokensIn: number;
      tokensOut: number;
      costUsd: number | null;
      stop: string | null;
      // Time until the first words of the answer arrived (budget L-02: 3 seconds).
      firstTextMs: number | null;
      // The whole call, for the usage record when the caller saves it.
      ms: number;
    }
  | { ok: false; reason: "no_key" | "busy" | "refused" | "unavailable" | "cancelled" };

// Streams an explanation from Claude, passing each piece of text to onText as it arrives
// (rule G-10: answers stream; the client's 60-second limit applies). Logs model, tokens,
// cost and time (rule G-08), never the question or the answer.
export async function streamExplanation(input: {
  turns: ExplainTurn[];
  userId: string;
  onText: (text: string) => void;
  signal?: AbortSignal;
  // Only the model test (step 3e) chooses another model; the app uses MODELS.explain.
  model?: ExplainModel;
  // A problem question: the answer goes into every issue in depth, so it may be longer.
  long?: boolean;
  // A spoken reply in voice mode: short.
  short?: boolean;
  // false: the caller records the usage itself, once it knows what kind of reply it was
  // (voice-mode small talk is free).
  record?: boolean;
}): Promise<ExplainResult> {
  const started = Date.now();
  const model = input.model ?? MODELS.explain;
  const settings = EXPLAIN_SETTINGS[model];
  let firstTextMs: number | null = null;
  try {
    const stream = getClaude().messages.stream(
      {
        model,
        max_tokens: input.short ? EXPLAIN_TALK_MAX_TOKENS : input.long ? EXPLAIN_LONG_MAX_TOKENS : EXPLAIN_MAX_TOKENS,
        // No long thinking before answering, so the first words appear quickly (budget: 3 s).
        ...(settings.thinking ? { thinking: settings.thinking } : {}),
        ...(settings.effort ? { output_config: { effort: settings.effort } } : {}),
        // The fixed instructions are cached, so repeat questions cost less.
        system: [{ type: "text", text: EXPLAIN_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: input.turns.map((turn) => ({ role: turn.role, content: turn.text })),
      },
      { signal: input.signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        firstTextMs ??= Date.now() - started;
        input.onText(event.delta.text);
      }
    }
    const message = await stream.finalMessage();
    const cost = costUsd(message.model, message.usage);
    console.info("ai call", {
      job: "explain",
      prompt: EXPLAIN_PROMPT_VERSION,
      userId: input.userId,
      model: message.model,
      tokensIn: message.usage.input_tokens,
      cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
      tokensOut: message.usage.output_tokens,
      costUsd: cost,
      ms: Date.now() - started,
      stop: message.stop_reason,
    });
    // A refused answer is not a question answered, so it does not count against the limit.
    if (message.stop_reason !== "refusal" && input.record !== false) {
      await recordUsage({
        kind: "explain",
        model: message.model,
        tokensIn:
          message.usage.input_tokens +
          (message.usage.cache_creation_input_tokens ?? 0) +
          (message.usage.cache_read_input_tokens ?? 0),
        tokensOut: message.usage.output_tokens,
        costUsd: cost,
        ms: Date.now() - started,
      });
    }
    if (message.stop_reason === "refusal") return { ok: false, reason: "refused" };
    return {
      ok: true,
      model: message.model,
      tokensIn:
        message.usage.input_tokens +
        (message.usage.cache_creation_input_tokens ?? 0) +
        (message.usage.cache_read_input_tokens ?? 0),
      tokensOut: message.usage.output_tokens,
      costUsd: cost,
      stop: message.stop_reason,
      firstTextMs,
      ms: Date.now() - started,
    };
  } catch (error) {
    console.error("ai call failed", { job: "explain", userId: input.userId, ...failureDetails(error), ms: Date.now() - started });
    if (error instanceof MissingKeyError) return { ok: false, reason: "no_key" };
    if (error instanceof Anthropic.APIUserAbortError) return { ok: false, reason: "cancelled" };
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return { ok: false, reason: "busy" };
    }
    return { ok: false, reason: "unavailable" };
  }
}
