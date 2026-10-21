import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { EXPLAIN_PROMPT_VERSION, EXPLAIN_SYSTEM } from "@/prompts/explain";
import { failureDetails, getClaude, MissingKeyError } from "./client";
import { costUsd } from "./costs";
import { MODELS } from "./models";

export type ExplainTurn = { role: "user" | "assistant"; text: string };

export type ExplainResult =
  | {
      ok: true;
      model: string;
      tokensIn: number;
      tokensOut: number;
      costUsd: number | null;
      stop: string | null;
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
}): Promise<ExplainResult> {
  const started = Date.now();
  try {
    const stream = getClaude().messages.stream(
      {
        model: MODELS.explain,
        max_tokens: 4_000,
        // No long thinking before answering, so the first words appear quickly (budget: 3 s).
        thinking: { type: "between_tools" },
        // The fixed instructions are cached, so repeat questions cost less.
        system: [{ type: "text", text: EXPLAIN_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: input.turns.map((turn) => ({ role: turn.role, content: turn.text })),
      },
      { signal: input.signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") input.onText(event.delta.text);
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
