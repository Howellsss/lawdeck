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


// How long a pause means the student has finished speaking (voice mode), and how long to wait
// for them to start before listening afresh.
export const END_OF_TURN_MS = 1500;
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
      clearInterval(timer);
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
