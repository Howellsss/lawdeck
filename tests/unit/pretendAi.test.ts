import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { pretendAiOn, streamPretendAnswer } = await import("@/server/ai/pretend");

describe("the pretend AI for the staging load test", () => {
  it("is on only with both staging settings, never on the production deployment", () => {
    expect(pretendAiOn({ LAWDECK_PRETEND_AI: "1", APP_ENV: "staging" })).toBe(true);
    expect(pretendAiOn({ LAWDECK_PRETEND_AI: "1", APP_ENV: "staging", VERCEL_ENV: "preview" })).toBe(true);
    expect(pretendAiOn({ LAWDECK_PRETEND_AI: "1", APP_ENV: "staging", VERCEL_ENV: "production" })).toBe(false);
    expect(pretendAiOn({ LAWDECK_PRETEND_AI: "1", APP_ENV: "production" })).toBe(false);
    expect(pretendAiOn({ LAWDECK_PRETEND_AI: "1" })).toBe(false);
    expect(pretendAiOn({ APP_ENV: "staging" })).toBe(false);
    expect(pretendAiOn({ LAWDECK_PRETEND_AI: "true", APP_ENV: "staging" })).toBe(false);
  });

  it("streams an answer that cites only the first passage and names no authority", async () => {
    vi.useFakeTimers();
    const parts: string[] = [];
    const done = streamPretendAnswer((t) => parts.push(t));
    await vi.runAllTimersAsync();
    expect(await done).toBe(true);
    const text = parts.join("");
    expect(text).toContain("[S1]");
    expect(text).not.toMatch(/\[S[2-9]\]|\bv\.? [A-Z]|Act|Rules/);
    vi.useRealTimers();
  });

  it("stops when the student cancels", async () => {
    const stop = new AbortController();
    stop.abort();
    expect(await streamPretendAnswer(() => {}, stop.signal)).toBe(false);
  });
});
