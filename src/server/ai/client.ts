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
    defaultHeaders: workspaceHeaders(process.env.ANTHROPIC_WORKSPACE_ID),
  });
  return client;
}

// A key that belongs to a person (sk-ant-usr...) rather than a workspace must say which
// workspace to use, or Claude refuses every call. The workspace ID is not secret. Anything that
// doesn't look like a workspace ID is ignored, so it can never change other headers.
export function workspaceHeaders(id: string | undefined): Record<string, string> {
  const trimmed = id?.trim();
  if (!trimmed) return {};
  if (!/^wrkspc_[A-Za-z0-9]{10,60}$/.test(trimmed)) {
    console.warn("ANTHROPIC_WORKSPACE_ID ignored: it does not look like a workspace ID");
    return {};
  }
  return { "anthropic-workspace-id": trimmed };
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
