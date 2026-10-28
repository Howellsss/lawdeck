import { expect, test, type Page } from "@playwright/test";

// Voice mode holds a conversation turn after turn (founder, 2026-10-28), whether it starts from
// the home screen or from a chat. The microphone, the answers and the audio are pretend.
const CHAT = "11111111-1111-4111-8111-111111111111";

// A tenth of a second of silence (a valid WAV file) as the "spoken" reply.
function silence(): Buffer {
  const n = 800;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + n, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(n, 40);
  return Buffer.concat([header, Buffer.alloc(n, 128)]);
}

async function pretend(page: Page, said: string[]) {
  const asked: string[] = [];
  const spoken: string[] = [];
  await page.addInitScript((words: string[]) => {
    let turn = 0;
    class FakeRecognition {
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      private timer?: ReturnType<typeof setTimeout>;
      start() {
        const text = words[turn++];
        if (!text) return;
        this.timer = setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
        }, 200);
      }
      stop() {
        clearTimeout(this.timer);
        setTimeout(() => this.onend?.(), 20);
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  }, said);
  await page.route("**/api/chats/*/answer", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as { question: string; level: string };
    asked.push(`${body.level}: ${body.question}`);
    const n = asked.length;
    const id = `2222222${n}-1111-4111-8111-111111111111`;
    const text = `Reply ${n}. What next?`;
    const events = [
      { type: "found", count: 0 },
      { type: "text", text },
      { type: "done", messageId: id, text, sources: [], notEnough: false, level: body.level },
    ];
    await route.fulfill({ contentType: "application/x-ndjson", body: events.map((e) => JSON.stringify(e)).join("\n") + "\n" });
  });
  await page.route("**/api/speech", async (route) => {
    spoken.push((JSON.parse(route.request().postData() ?? "{}") as { messageId: string }).messageId);
    await route.fulfill({ contentType: "audio/wav", headers: { "X-Speech-Parts": "1" }, body: silence() });
  });
  return { asked, spoken };
}

test("voice mode keeps talking, turn after turn, from a chat", async ({ page }) => {
  const { asked, spoken } = await pretend(page, ["Hey, what's up?", "Tell me about originating processes", "Yeah, please go on"]);
  await page.goto("/test-pages/voice");
  await page.getByRole("button", { name: /Voice mode/ }).click();
  await expect.poll(() => spoken.length, { timeout: 30_000 }).toBe(3);
  expect(asked).toEqual(["talk: Hey, what's up?", "talk: Tell me about originating processes", "talk: Yeah, please go on"]);
  await expect(page.getByText("Listening… go ahead.")).toBeVisible();
  await expect(page.getByText("Searching the library")).toHaveCount(0);
  await page.getByRole("button", { name: "End voice mode" }).click();
  await expect(page.getByText("Listening… go ahead.")).toHaveCount(0);
});

test("voice mode started on the home screen carries on in the chat it opens", async ({ page }) => {
  const { asked, spoken } = await pretend(page, ["All good. Tell me about pleadings", "Yes, go on"]);
  await page.goto("/test-pages/voice");
  // What the home screen leaves behind when it opens a chat in voice mode.
  await page.evaluate((id) => {
    sessionStorage.setItem(`lawdeck-ask-${id}`, "Hey, what's up?");
    sessionStorage.setItem(`lawdeck-talk-${id}`, "1");
  }, CHAT);
  await page.reload();
  await expect.poll(() => spoken.length, { timeout: 30_000 }).toBe(3);
  expect(asked).toEqual(["talk: Hey, what's up?", "talk: All good. Tell me about pleadings", "talk: Yes, go on"]);
  await expect(page.getByText("Voice mode ended")).toHaveCount(0);
});
