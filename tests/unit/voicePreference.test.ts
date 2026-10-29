import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readVoice, saveVoice, subscribeVoice, VOICE_STORAGE_KEY } from "@/lib/voicePreference";

// The voice choice is shared by the Account page, voice mode and the menu beside Read: a change in
// one must reach the others straight away (founder, 2026-10-29).
describe("voice preference", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uses the British female voice until a student chooses", () => {
    expect(readVoice()).toBe("uk-female");
  });

  it("ignores a saved value that is not one of the six voices", () => {
    localStorage.setItem(VOICE_STORAGE_KEY, "female");
    expect(readVoice()).toBe("uk-female");
  });

  it("tells every open picker when the voice changes, and stops when unsubscribed", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = subscribeVoice(first);
    subscribeVoice(second);
    saveVoice("us-male");
    expect(readVoice()).toBe("us-male");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    stopFirst();
    saveVoice("ng-female");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});
