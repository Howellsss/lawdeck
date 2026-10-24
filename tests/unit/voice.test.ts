import { describe, expect, it } from "vitest";
import { voiceErrorMessage } from "@/components/learn/VoiceButton";

describe("speaking a question", () => {
  it("explains each browser problem in plain words, with a next step", () => {
    expect(voiceErrorMessage("not-allowed")).toMatch(/Allow it in your browser/);
    expect(voiceErrorMessage("service-not-allowed")).toMatch(/Allow it in your browser/);
    expect(voiceErrorMessage("no-speech")).toMatch(/didn’t hear anything/);
    expect(voiceErrorMessage("network")).toMatch(/internet connection/);
    expect(voiceErrorMessage("something-new")).toMatch(/type your question instead/);
  });
});
