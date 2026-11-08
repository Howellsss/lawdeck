"use client";

import { useSyncExternalStore } from "react";
import { audioSessionFor } from "./speaker";

// The browser's own speech recognition (Chrome sends the audio to Google, Safari to Apple, to
// turn it into words). Lawdeck never receives or stores the recording, only the words.

// The parts of the browser's speech recognition used here. It is not in TypeScript's built-in
// list yet, so it is described by hand.
type SpeechResultList = ArrayLike<{ isFinal: boolean } & ArrayLike<{ transcript: string }>>;
export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
export type RecognitionConstructor = new () => Recognition;

export function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}


// Plain-language messages for the browser's error codes.
export function voiceErrorMessage(code: string): string {
  if (code === "not-allowed" || code === "service-not-allowed")
    return "Lawdeck can’t use your microphone. Allow it in your browser’s settings, then try again.";
  if (code === "no-speech") return "Lawdeck didn’t hear anything. Tap the microphone and try again.";
  if (code === "network") return "Speaking needs an internet connection. Check it, or type your question instead.";
  return "Speaking didn’t work this time. Try again, or type your question instead.";
}


// How long a pause means the student has finished speaking (voice mode), and how long to wait
// for them to start before listening afresh. 0.7 s (founder, 2026-11-08: "faster"); was 1.1 s.
export const END_OF_TURN_MS = 700;
const WAIT_FOR_SPEECH_MS = 15_000;

// Listens for one turn of a conversation and returns its words (voice mode). Short pauses
// mid-sentence do not end the turn: it ends once the student has been quiet for END_OF_TURN_MS.
// Rejects with the browser's error code ("no-speech", "not-allowed" …); `cancel` stops early.
export function listenOnce(cancel?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return reject(new Error("unsupported"));
    const recognition = new Constructor();
    recognition.lang = "en-NG";
    recognition.interimResults = true;
    recognition.continuous = true;
    let words = "";
    let failed = "";
    let lastHeard = Date.now();
    const started = Date.now();
    recognition.onresult = (event) => {
      words = "";
      for (let i = 0; i < event.results.length; i++) words += event.results[i][0]?.transcript ?? "";
      lastHeard = Date.now();
    };
    recognition.onerror = (event) => {
      failed = event.error;
    };
    const timer = setInterval(() => {
      const quiet = Date.now() - lastHeard;
      if (words.trim() ? quiet >= END_OF_TURN_MS : Date.now() - started >= WAIT_FOR_SPEECH_MS) recognition.stop();
    }, 200);
    recognition.onend = () => {
      // Phones often switch the microphone off by themselves after a few quiet seconds. While
      // nothing has been heard yet, it is switched straight back on, up to WAIT_FOR_SPEECH_MS
      // (founder, 2026-11-08: "more sensitive").
      const quietRestart =
        !words.trim() &&
        !cancel?.aborted &&
        (failed === "" || failed === "no-speech") &&
        Date.now() - started < WAIT_FOR_SPEECH_MS;
      if (quietRestart) {
        try {
          failed = "";
          recognition.start();
          return;
        } catch {
          // The browser would not restart it: end the turn as before.
        }
      }
      clearInterval(timer);
      cancel?.removeEventListener("abort", stop);
      if (cancel?.aborted) reject(new Error("aborted"));
      else if (words.trim()) resolve(words.trim());
      else reject(new Error(failed || "no-speech"));
    };
    const stop = () => recognition.stop();
    cancel?.addEventListener("abort", stop);
    audioSessionFor("play-and-record");
    recognition.start();
  });
}

const noSubscription = () => () => {};

// Whether this browser understands speech, read only in the browser (the server shows no button).
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(noSubscription, () => recognitionConstructor() !== null, () => false);
}

// How long dictation waits in silence before switching the microphone off by itself.
export const DICTATION_SILENCE_MS = 30_000;

// Dictation (founder, 2026-11-06: "it stops at some point"): keeps listening through pauses until
// the student taps Stop, like dictation in other apps. Browsers end a listening session on their
// own now and then (Chrome after about a minute); it starts a new one at once and keeps the words
// already heard. After DICTATION_SILENCE_MS of silence it stops, so the microphone is never left on.
// Returns a function that stops it.
export function dictate(
  Constructor: RecognitionConstructor,
  handlers: { onText: (words: string) => void; onError: (code: string) => void; onStop: () => void },
  now: () => number = Date.now,
): () => void {
  let kept = "";
  let session = "";
  let lastHeard = now();
  let stopped = false;
  let current: Recognition | null = null;
  const joined = () => [kept, session].filter(Boolean).join(" ");

  const finish = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    current?.stop();
    handlers.onStop();
  };

  const listen = () => {
    const recognition = new Constructor();
    current = recognition;
    session = "";
    recognition.lang = "en-NG";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let words = "";
      for (let i = 0; i < event.results.length; i++) words += event.results[i][0]?.transcript ?? "";
      session = words.trim();
      lastHeard = now();
      handlers.onText(joined());
    };
    recognition.onerror = (event) => {
      // Silence and the browser's own restarts are not problems; anything else stops dictation.
      if (event.error === "no-speech" || event.error === "aborted") return;
      handlers.onError(event.error);
      finish();
    };
    recognition.onend = () => {
      if (stopped) return;
      kept = joined();
      session = "";
      try {
        listen();
      } catch {
        finish();
      }
    };
    audioSessionFor("play-and-record");
    recognition.start();
  };

  const timer = setInterval(() => {
    if (now() - lastHeard >= DICTATION_SILENCE_MS) finish();
  }, 1000);
  listen();
  return finish;
}
