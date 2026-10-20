import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getClaude, MissingKeyError } from "./client";
import { MODELS } from "./models";

export type HealthCheckResult =
  | { ok: true; reply: string; model: string; inputTokens: number; outputTokens: number; ms: number }
  | { ok: false; message: string };

// Sends Claude one tiny message to prove the key, billing and connection work.
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const started = Date.now();
  try {
    const response = await getClaude().messages.create({
      model: MODELS.healthCheck,
      max_tokens: 50,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: "Reply with OK and nothing else." }],
    });
    const reply = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    return {
      ok: true,
      reply,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      ms: Date.now() - started,
    };
  } catch (error) {
    return { ok: false, message: explain(error) };
  }
}

// Plain-language messages; details stay on the server (rule I-01).
function explain(error: unknown): string {
  if (error instanceof MissingKeyError) {
    return "The Claude key is not set on the server. Add ANTHROPIC_API_KEY to the environment variables.";
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return "Claude did not accept the key. Check that ANTHROPIC_API_KEY is copied correctly and is active.";
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return "The key is not allowed to use this model. Check the Anthropic account and workspace settings.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Claude is busy or the account limit was reached. Wait a minute and try again, or check credit and limits.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Could not reach Claude. Check the internet connection and try again.";
  }
  if (error instanceof Anthropic.APIError) {
    console.error("Health check failed", { status: error.status, name: error.name });
    return `Claude returned an error (status ${error.status}). Try again shortly.`;
  }
  console.error("Health check failed", { name: (error as Error)?.name });
  return "Something went wrong on the server. Try again shortly.";
}
