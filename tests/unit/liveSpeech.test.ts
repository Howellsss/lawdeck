import { beforeEach, describe, expect, it, vi } from "vitest";

// A pretend voice service: each sentence "audio" is its own text, ready after a delay that makes
// later sentences finish first, to prove they are still sent in order.
const synthesize = vi.fn();
const recordUsage = vi.fn();
vi.mock("@/server/ai/speech", () => ({
  synthesizeSpeech: synthesize,
  speechCostUsd: (chars: number) => chars / 1_000_000,
  VOICE_NAMES: { "uk-female": "en-GB-SoniaNeural", "ng-male": "en-NG-AbeoNeural" },
}));
vi.mock("@/server/ai/usage", () => ({ recordUsage }));
const { LiveSpeech } = await import("@/server/learn/liveSpeech");

const audioOf = (text: string) => new TextEncoder().encode(text).buffer;
const textOf = (data: string) => Buffer.from(data, "base64").toString();

describe("speaking a reply while it is written", () => {
  beforeEach(() => {
    recordUsage.mockReset();
    synthesize.mockReset().mockImplementation(async (text: string) => {
      await new Promise((resolve) => setTimeout(resolve, text.startsWith("Hey") ? 30 : 5));
      return { ok: true, audio: audioOf(text) };
    });
  });

  it("speaks each finished sentence at once, in order, and the rest at the end", async () => {
    const sent: { type: string; data?: string }[] = [];
    const live = new LiveSpeech("uk-female", (event) => sent.push(event));
    live.push("Hey! Doing well [S1]");
    expect(synthesize).toHaveBeenCalledTimes(1);
    live.push(", thanks. What are we");
    live.push(" studying today?");
    await live.end();
    expect(sent.map((event) => textOf(event.data ?? ""))).toEqual(["Hey!", "Doing well, thanks.", "What are we studying today?"]);
    expect(synthesize).toHaveBeenCalledWith("Doing well, thanks.", "uk-female", false);
    // The reply's speech is recorded once, with its characters, never its text.
    expect(recordUsage).toHaveBeenCalledTimes(1);
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ kind: "speech", model: "en-GB-SoniaNeural", tokensIn: 50 }));
  });

  it("stops speaking after a failure and says so once", async () => {
    synthesize.mockResolvedValue({ ok: false, reason: "unavailable", detail: "x" });
    const sent: { type: string }[] = [];
    const live = new LiveSpeech("ng-male", (event) => sent.push(event));
    live.push("One. Two. Three.");
    await live.end();
    expect(sent).toEqual([{ type: "audio_error", message: expect.any(String) }]);
    expect(recordUsage).not.toHaveBeenCalled();
  });
});
