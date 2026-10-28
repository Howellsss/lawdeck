import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A pretend database and voice service: nothing real is called.
const recordUsage = vi.fn();
const message = vi.fn();
const usedToday = vi.fn();
vi.mock("@/server/ai/usage", () => ({ recordUsage }));
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: message }) }) }),
    rpc: async () => usedToday(),
  }),
}));

const { synthesizeSpeech, SPEECH_DAILY_CHARS } = await import("@/server/ai/speech");
const { speakAnswerPart, MORE_QUESTION } = await import("@/server/learn/speech");
const ID = "11111111-1111-4111-8111-111111111111";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("AZURE_SPEECH_KEY", "test-key");
  vi.stubEnv("AZURE_SPEECH_REGION", "westeurope");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  recordUsage.mockReset();
  usedToday.mockReset().mockReturnValue({ data: [{ used: 0, unlimited: false }], error: null });
  message.mockReset().mockResolvedValue({
    data: { role: "assistant", content: { text: "## Short answer\nTwo parties are needed.\n\n## The rule\nMore here." } },
    error: null,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the voice service call", () => {
  it("sends Nigerian English SSML with the key in a header, and records characters and cost", async () => {
    const result = await synthesizeSpeech("Hello Njemanze.", "male");
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
    expect(init.headers["Ocp-Apim-Subscription-Key"]).toBe("test-key");
    expect(init.body).toContain('voice name="en-NG-AbeoNeural"');
    expect(init.body).toContain('<sub alias="Njeh manzeh">Njemanze</sub>');
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ kind: "speech", model: "en-NG-AbeoNeural", tokensIn: 15 }));
  });

  it("reports a failure without the text, and records nothing", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    expect(await synthesizeSpeech("Secret answer text", "female")).toMatchObject({ ok: false, reason: "busy", detail: expect.stringContaining("429") });
    expect(JSON.stringify(errors.mock.calls)).not.toContain("Secret");
    expect(recordUsage).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("does nothing without the key", async () => {
    vi.stubEnv("AZURE_SPEECH_KEY", "");
    expect(await synthesizeSpeech("Hi.", "female")).toMatchObject({ ok: false, reason: "unavailable", detail: expect.stringContaining("not set") });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("reading an answer", () => {
  it("reads the short answer and offers the rest", async () => {
    const result = await speakAnswerPart({ messageId: ID, part: 0, scope: "short", voice: "female" });
    expect(result).toMatchObject({ ok: true, parts: 1 });
    expect(fetchMock.mock.calls[0][1].body).toContain(`Two parties are needed. ${MORE_QUESTION}`);
  });

  it("finds nothing for an answer the student cannot see, or a question", async () => {
    message.mockResolvedValue({ data: null, error: null });
    expect(await speakAnswerPart({ messageId: ID, part: 0, scope: "full", voice: "female" })).toMatchObject({ ok: false, status: 404 });
    message.mockResolvedValue({ data: { role: "user", content: { text: "Hi" } }, error: null });
    expect(await speakAnswerPart({ messageId: ID, part: 0, scope: "full", voice: "female" })).toMatchObject({ ok: false, status: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops at the daily limit, but not for reviewers", async () => {
    usedToday.mockReturnValue({ data: [{ used: SPEECH_DAILY_CHARS - 5, unlimited: false }], error: null });
    expect(await speakAnswerPart({ messageId: ID, part: 0, scope: "full", voice: "female" })).toMatchObject({ ok: false, status: 429 });
    expect(fetchMock).not.toHaveBeenCalled();
    usedToday.mockReturnValue({ data: [{ used: SPEECH_DAILY_CHARS * 2, unlimited: true }], error: null });
    expect((await speakAnswerPart({ messageId: ID, part: 0, scope: "full", voice: "female" })).ok).toBe(true);
  });

  it("says the voice is unavailable, not that the limit is used up, when the check fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    usedToday.mockReturnValue({ data: null, error: { code: "PGRST202" } });
    const result = await speakAnswerPart({ messageId: ID, part: 0, scope: "full", voice: "female" });
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(!result.ok && result.message).not.toMatch(/limit/);
    expect(fetchMock).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("tells staff why the voice failed: a wrong key or a wrong region", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));
    expect(await synthesizeSpeech("Hi.", "female")).toMatchObject({ detail: expect.stringContaining("KEY 1") });
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await synthesizeSpeech("Hi.", "female")).toMatchObject({ detail: expect.stringContaining("region") });
    vi.stubEnv("AZURE_SPEECH_REGION", "North Europe");
    expect(await synthesizeSpeech("Hi.", "female")).toMatchObject({ detail: expect.stringContaining("small letters") });
    errors.mockRestore();
  });
});
