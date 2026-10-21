import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// The one place Lawdeck connects to Claude (rule G-01). Server only: the key never reaches the browser.
let client: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MissingKeyError();
  }
  client ??= new Anthropic({
    timeout: 60_000, // rule G-10: no request waits longer than 60 seconds
    maxRetries: 2, // busy or rate-limited replies are retried automatically
  });
  return client;
}

export class MissingKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set");
    this.name = "MissingKeyError";
  }
}

// What went wrong on a failed call, for the server log (rule G-08): the status, the error
// type, Claude's short reason (for example "credit balance is too low") and the request id
// Anthropic support asks for. Never the question, the answer or the key.
export function failureDetails(error: unknown): Record<string, string | number | null> {
  const name = error instanceof Error ? error.constructor.name : "unknown";
  if (!(error instanceof Anthropic.APIError)) return { name };
  const body = error.error as { error?: { message?: unknown } } | undefined;
  const reason = typeof body?.error?.message === "string" ? body.error.message.slice(0, 160) : null;
  return { name, status: error.status ?? null, type: error.type ?? null, reason, requestId: error.requestID ?? null };
}
