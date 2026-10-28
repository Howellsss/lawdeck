"use client";

import { useSyncExternalStore } from "react";

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
type RecognitionConstructor = new () => Recognition;

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


// Listens for one spoken sentence and returns its words (voice conversations). Rejects with the
// browser's error code ("no-speech", "not-allowed" …); `cancel` stops listening early.
export function listenOnce(cancel?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return reject(new Error("unsupported"));
    const recognition = new Constructor();
    recognition.lang = "en-NG";
    recognition.interimResults = false;
    recognition.continuous = false;
    let words = "";
    let failed = "";
    recognition.onresult = (event) => {
      words = "";
      for (let i = 0; i < event.results.length; i++) words += event.results[i][0]?.transcript ?? "";
    };
    recognition.onerror = (event) => {
      failed = event.error;
    };
    recognition.onend = () => {
      cancel?.removeEventListener("abort", stop);
      if (cancel?.aborted) reject(new Error("aborted"));
      else if (words.trim()) resolve(words.trim());
      else reject(new Error(failed || "no-speech"));
    };
    const stop = () => recognition.stop();
    cancel?.addEventListener("abort", stop);
    recognition.start();
  });
}

const noSubscription = () => () => {};

// Whether this browser understands speech, read only in the browser (the server shows no button).
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(noSubscription, () => recognitionConstructor() !== null, () => false);
}
