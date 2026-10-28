import { expect, test, type Page } from "@playwright/test";

// Voice mode is a spoken conversation on the same screen, like ChatGPT's (founder, 2026-10-28):
// it listens, speaks each sentence as it arrives, listens again, and never leaves the page. The
// microphone, the answers and the audio are pretend.

// A tenth of a second of silence (a valid WAV file) as each "spoken" sentence.
function silence(): string {
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
  return Buffer.concat([header, Buffer.alloc(n, 128)]).toString("base64");
}

async function pretend(page: Page, said: string[]) {
  const asked: string[] = [];
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
    const body = JSON.parse(route.request().postData() ?? "{}") as { question: string; level: string; voice?: string };
    asked.push(`${body.level}/${body.voice}: ${body.question}`);
    const n = asked.length;
    const events = [
      { type: "text", text: `Reply ${n}. ` },
      { type: "audio", data: silence() },
      { type: "text", text: "What next?" },
      { type: "audio", data: silence() },
      { type: "done", messageId: `2222222${n}-1111-4111-8111-111111111111`, text: `Reply ${n}. What next?`, sources: [], notEnough: false, level: body.level },
    ];
    await route.fulfill({ contentType: "application/x-ndjson", body: events.map((e) => JSON.stringify(e)).join("\n") + "\n" });
  });
  // Voice mode never fetches audio separately: it arrives with the reply.
  await page.route("**/api/speech", (route) => route.abort());
  return asked;
}

test("voice mode talks back and forth on the same screen", async ({ page }) => {
  const asked = await pretend(page, ["Hey, what's up?", "Tell me about originating processes", "Yeah, please go on"]);
  await page.goto("/test-pages/voice");
  await page.getByRole("button", { name: /Voice mode/ }).click();
  const dialog = page.getByRole("dialog", { name: "Voice mode" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => asked.length, { timeout: 30_000 }).toBe(3);
  expect(asked).toEqual([
    "talk/female: Hey, what's up?",
    "talk/female: Tell me about originating processes",
    "talk/female: Yeah, please go on",
  ]);
  // Still on the same page, listening for the next thing; nothing written out.
  await expect(dialog.getByText("Listening")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/test-pages\/voice$/);
  await expect(page.getByText("Reply 1")).toHaveCount(0);
  await expect(page.getByText("Searching the library")).toHaveCount(0);
  await dialog.getByRole("button", { name: "End" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("ended in 11111111");
});
