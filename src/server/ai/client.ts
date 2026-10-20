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
