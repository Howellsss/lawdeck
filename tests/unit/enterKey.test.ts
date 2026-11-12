import { describe, expect, it } from "vitest";
import { sendsChatMessage, sendsQuestion } from "@/lib/enterKey";

const key = (over: Partial<{ key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; isComposing: boolean }> = {}) => ({
  key: over.key ?? "Enter",
  shiftKey: over.shiftKey ?? false,
  ctrlKey: over.ctrlKey ?? false,
  metaKey: over.metaKey ?? false,
  nativeEvent: { isComposing: over.isComposing ?? false },
});

describe("Enter in the question box (founder, 2026-11-12)", () => {
  it("starts a new line instead of sending", () => {
    expect(sendsQuestion(key())).toBe(false);
    expect(sendsQuestion(key({ shiftKey: true }))).toBe(false);
  });

  it("sends with Ctrl + Enter or ⌘ + Enter on a computer", () => {
    expect(sendsQuestion(key({ ctrlKey: true }))).toBe(true);
    expect(sendsQuestion(key({ metaKey: true }))).toBe(true);
    expect(sendsQuestion(key({ ctrlKey: true, isComposing: true }))).toBe(false);
  });
});

describe("Enter in campus chat", () => {
  it("starts a new line on a phone", () => {
    expect(sendsChatMessage(key(), true)).toBe(false);
  });

  it("sends on a computer, with Shift + Enter for a new line", () => {
    expect(sendsChatMessage(key(), false)).toBe(true);
    expect(sendsChatMessage(key({ shiftKey: true }), false)).toBe(false);
    expect(sendsChatMessage(key({ isComposing: true }), false)).toBe(false);
  });
});
