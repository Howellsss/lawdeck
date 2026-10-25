"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VoiceWave } from "@/components/ui/VoiceWave";
import { Icon } from "@/components/ui/Icon";

// Speaking a question (founder, 2026-10-24). Uses the speech recognition built into the browser
// (Chrome sends the audio to Google, Safari to Apple, to turn it into words); Lawdeck never
// receives or stores the recording, only the words, which appear in the box to check before
// sending. Browsers without it (for example Firefox) simply show no button.

// The parts of the browser's speech recognition used here. It is not in TypeScript's built-in
// list yet, so it is described by hand.
type SpeechResultList = ArrayLike<{ isFinal: boolean } & ArrayLike<{ transcript: string }>>;
type Recognition = {
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

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscription = () => () => {};

// Plain-language messages for the browser's error codes.
export function voiceErrorMessage(code: string): string {
  if (code === "not-allowed" || code === "service-not-allowed")
    return "Lawdeck can’t use your microphone. Allow it in your browser’s settings, then try again.";
  if (code === "no-speech") return "Lawdeck didn’t hear anything. Tap the microphone and try again.";
  if (code === "network") return "Speaking needs an internet connection. Check it, or type your question instead.";
  return "Speaking didn’t work this time. Try again, or type your question instead.";
}

export function VoiceButton({
  onText,
  onError,
  disabled,
  compact = false,
}: {
  // Called with the words heard so far (the whole sentence, replacing earlier partial words).
  onText: (words: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  // Smaller on phones, to match the composer's other buttons.
  compact?: boolean;
}) {
  // Whether the browser can do this, read only in the browser (the server renders no button).
  const supported = useSyncExternalStore(noSubscription, () => recognitionConstructor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  if (!supported) return null;

  function start() {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.lang = "en-NG";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let words = "";
      for (let i = 0; i < event.results.length; i++) words += event.results[i][0]?.transcript ?? "";
      onText(words.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") onError(voiceErrorMessage(event.error));
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  // While listening: a moving wave of bars beside a filled button that reads "Stop dictation".
  return (
    <span className="flex items-center gap-2">
      {listening && <VoiceWave className="text-ink" />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => (listening ? recognitionRef.current?.stop() : start())}
        aria-label={listening ? "Stop dictation" : "Speak your question"}
        title={listening ? "Stop dictation" : "Speak your question"}
        aria-pressed={listening}
        className={`flex ${compact ? "size-9 sm:size-10" : "size-11"} shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
          listening ? "bg-ink text-on-ink" : "bg-pill text-ink"
        }`}
      >
        <Icon name={listening ? "stop" : "mic"} size={compact ? 17 : 18} />
        <span className="sr-only" aria-live="polite">
          {listening ? "Listening" : ""}
        </span>
      </button>
    </span>
  );
}
