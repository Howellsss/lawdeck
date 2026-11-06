import { afterEach, describe, expect, it, vi } from "vitest";
import { dictate, DICTATION_SILENCE_MS, type Recognition } from "@/components/learn/recognition";

// A stand-in for the browser's speech recognition: each new session is kept so the test can say
// words, end the session (as browsers do on their own) or raise an error.
class FakeRecognition implements Recognition {
  static sessions: FakeRecognition[] = [];
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: Recognition["onresult"] = null;
  onerror: Recognition["onerror"] = null;
  onend: Recognition["onend"] = null;
  stopped = false;
  constructor() {
    FakeRecognition.sessions.push(this);
  }
  start() {}
  stop() {
    this.stopped = true;
  }
  say(...parts: string[]) {
    this.onresult?.({ resultIndex: 0, results: parts.map((t) => Object.assign([{ transcript: t }], { isFinal: true })) });
  }
}

describe("dictation keeps listening until the student taps Stop", () => {
  afterEach(() => {
    FakeRecognition.sessions = [];
    vi.useRealTimers();
  });

  it("listens continuously and keeps the words when the browser ends a session on its own", () => {
    vi.useFakeTimers();
    const heard: string[] = [];
    const onStop = vi.fn();
    dictate(FakeRecognition, { onText: (w) => heard.push(w), onError: vi.fn(), onStop });
    const first = FakeRecognition.sessions[0];
    expect(first.continuous).toBe(true);
    first.say("The claimant must", " file a writ");
    first.onend?.();
    expect(FakeRecognition.sessions).toHaveLength(2);
    FakeRecognition.sessions[1].say("within thirty days");
    expect(heard.at(-1)).toBe("The claimant must file a writ within thirty days");
    expect(onStop).not.toHaveBeenCalled();
  });

  it("a pause (no speech) does not stop it; Stop does", () => {
    vi.useFakeTimers();
    const onStop = vi.fn();
    const stop = dictate(FakeRecognition, { onText: vi.fn(), onError: vi.fn(), onStop });
    FakeRecognition.sessions[0].onerror?.({ error: "no-speech" });
    FakeRecognition.sessions[0].onend?.();
    expect(onStop).not.toHaveBeenCalled();
    stop();
    expect(onStop).toHaveBeenCalledOnce();
    expect(FakeRecognition.sessions.at(-1)?.stopped).toBe(true);
    FakeRecognition.sessions.at(-1)?.onend?.();
    expect(FakeRecognition.sessions).toHaveLength(2);
  });

  it("switches itself off after 30 seconds of silence, and on a real error", () => {
    vi.useFakeTimers();
    const onStop = vi.fn();
    dictate(FakeRecognition, { onText: vi.fn(), onError: vi.fn(), onStop });
    vi.advanceTimersByTime(DICTATION_SILENCE_MS - 2000);
    expect(onStop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onStop).toHaveBeenCalledOnce();

    const onError = vi.fn();
    const onStop2 = vi.fn();
    dictate(FakeRecognition, { onText: vi.fn(), onError, onStop: onStop2 });
    FakeRecognition.sessions.at(-1)?.onerror?.({ error: "not-allowed" });
    expect(onError).toHaveBeenCalledWith("not-allowed");
    expect(onStop2).toHaveBeenCalledOnce();
  });
});
