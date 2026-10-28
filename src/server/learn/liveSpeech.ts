import "server-only";
import { SentenceSplitter } from "@/lib/sentences";
import { speakableText } from "@/lib/speech";
import type { Voice } from "@/schemas/voice";
import { synthesizeSpeech } from "@/server/ai/speech";

export type LiveSpeechEvent = { type: "audio"; data: string } | { type: "audio_error"; message: string };

// Voice mode (founder, 2026-10-28: "it responds immediately"): each sentence of a reply is turned
// into speech as soon as it is written, and sent to the page in order, so Lawdeck starts talking
// while it is still thinking of the rest. Only the checked reply text is spoken (it comes through
// the citation check first), from the server; nothing else reaches the voice service.
export class LiveSpeech {
  private readonly split = new SentenceSplitter();
  private chain: Promise<void> = Promise.resolve();
  private failed = false;

  constructor(
    private readonly voice: Voice,
    private readonly send: (event: LiveSpeechEvent) => void,
  ) {}

  push(text: string) {
    for (const sentence of this.split.push(text)) this.say(sentence);
  }

  // Speaks what is left and waits until every sentence has been sent.
  async end() {
    for (const sentence of this.split.end()) this.say(sentence);
    await this.chain;
  }

  private say(sentence: string) {
    const spoken = speakableText(sentence);
    if (!spoken || this.failed) return;
    // Started now, sent in order: the next sentence is being made while this one plays.
    const audio = synthesizeSpeech(spoken, this.voice);
    this.chain = this.chain.then(async () => {
      const result = await audio;
      if (this.failed) return;
      if (result.ok) this.send({ type: "audio", data: Buffer.from(result.audio).toString("base64") });
      else {
        this.failed = true;
        this.send({ type: "audio_error", message: "Lawdeck’s voice is not available right now. The reply is in the chat." });
      }
    });
  }
}
