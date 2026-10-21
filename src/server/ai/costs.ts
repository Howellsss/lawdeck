import "server-only";

// US dollars per million tokens (Anthropic price list, 2026-10). Used to log each call's cost.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

// Cache writes cost 1.25 times the input price and cache reads 0.1 times.
export function costUsd(model: string, usage: TokenUsage): number | null {
  const price = Object.entries(PRICES).find(([name]) => model.startsWith(name))?.[1];
  if (!price) return null;
  const input =
    usage.input_tokens + 1.25 * (usage.cache_creation_input_tokens ?? 0) + 0.1 * (usage.cache_read_input_tokens ?? 0);
  return Math.round(((input * price.input + usage.output_tokens * price.output) / 1_000_000) * 1_000_000) / 1_000_000;
}
