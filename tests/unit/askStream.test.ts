import { afterEach, describe, expect, it, vi } from "vitest";
import { askQuestion, takePendingQuestion } from "@/components/learn/askStream";
import { titleFrom } from "@/server/learn/ask";
import type { AnswerEvent } from "@/server/learn/ask";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(response: Response): Promise<AnswerEvent[]> {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  const events: AnswerEvent[] = [];
  await askQuestion("3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a", "Why?", (event) => events.push(event));
  return events;
}

describe("reading the answer stream", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads events even when a line arrives in pieces", async () => {
    const done = { type: "done", messageId: "m1", text: "Hello there.", sources: [], notEnough: false };
    const body = streamOf(['{"type":"text","te', 'xt":"Hello "}\n{"type":"text","text":"there."}\n', `${JSON.stringify(done)}\n`]);
    expect(await collect(new Response(body))).toEqual([
      { type: "text", text: "Hello " },
      { type: "text", text: "there." },
      done,
    ]);
  });

  it("explains a refusal from the server plainly", async () => {
    const events = await collect(Response.json({ message: "Sign in to ask Lawdeck a question." }, { status: 401 }));
    expect(events).toEqual([{ type: "error", message: "Sign in to ask Lawdeck a question." }]);
  });

  it("says so when the answer is cut off before it finishes", async () => {
    const events = await collect(new Response(streamOf(['{"type":"text","text":"Half"}\n'])));
    expect(events.at(-1)).toEqual({ type: "error", message: "The answer was cut off. Please try again." });
  });

  it("copes when the network is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    const events: AnswerEvent[] = [];
    await askQuestion("id", "Why?", (event) => events.push(event));
    expect(events[0]?.type).toBe("error");
  });

  it("never fails when the browser blocks storage", () => {
    expect(takePendingQuestion("id")).toBeNull();
  });
});

describe("chat titles", () => {
  it("come from the question, shortened and tidied", () => {
    expect(titleFrom("  How is   a claim\nstarted? ")).toBe("How is a claim started?");
    expect(titleFrom("x".repeat(100))).toHaveLength(80);
    expect(titleFrom("x".repeat(100)).endsWith("…")).toBe(true);
  });
});
