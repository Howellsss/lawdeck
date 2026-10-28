import "server-only";
import { PRONUNCIATIONS } from "@/lib/pronunciations";
import { speechSsml } from "@/lib/speech";
import type { Voice } from "@/schemas/voice";
import { recordUsage } from "./usage";

// Lawdeck's voice (founder, 2026-10-28): Microsoft Azure's Nigerian English voices, which say
// Nigerian names properly, plus Lawdeck's own pronunciation list. Only answer text is sent, never
// a student's name, email or details. Called only from the server; the key never reaches a browser.
export const VOICE_NAMES: Record<Voice, string> = {
  female: "en-NG-EzinneNeural",
  male: "en-NG-AbeoNeural",
};

// US dollars per million characters (Azure neural voices, 2026-10; the first 500,000 characters
// a month are free on the free tier, which this does not subtract). Used to log each call's cost.
const USD_PER_MILLION_CHARS = 16;

// Each student may hear up to this many characters a day (Lagos time), about 10 long answers.
// Reviewers and admins are not limited. Change it here.
export const SPEECH_DAILY_CHARS = 40_000;

// Azure answers in about a second; a part that takes longer than this is given up on.
const TIMEOUT_MS = 20_000;

export function speechConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

export type SpeechResult = { ok: true; audio: ArrayBuffer } | { ok: false; reason: "unavailable" | "busy" };

export async function synthesizeSpeech(text: string, voice: Voice): Promise<SpeechResult> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region || !/^[a-z0-9]+$/.test(region)) return { ok: false, reason: "unavailable" };
  const voiceName = VOICE_NAMES[voice];
  const started = Date.now();
  try {
    const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "Lawdeck",
      },
      body: speechSsml(text, voiceName, PRONUNCIATIONS),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // The status only: never the text being read (rule I-03).
      console.error("speech failed", { status: response.status });
      return { ok: false, reason: response.status === 429 ? "busy" : "unavailable" };
    }
    const audio = await response.arrayBuffer();
    await recordUsage({
      kind: "speech",
      model: voiceName,
      tokensIn: text.length,
      tokensOut: 0,
      costUsd: Math.round(((text.length * USD_PER_MILLION_CHARS) / 1_000_000) * 1_000_000) / 1_000_000,
      ms: Date.now() - started,
    });
    return { ok: true, audio };
  } catch (error) {
    console.error("speech failed", { name: (error as Error)?.name });
    return { ok: false, reason: "unavailable" };
  }
}
