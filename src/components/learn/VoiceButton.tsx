"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VoiceWave } from "@/components/ui/VoiceWave";
import { Icon } from "@/components/ui/Icon";
import { dictate, recognitionConstructor, voiceErrorMessage } from "./recognition";

export { voiceErrorMessage };

// Speaking a question (founder, 2026-10-24). Uses the speech recognition built into the browser
// (Chrome sends the audio to Google, Safari to Apple, to turn it into words); Lawdeck never
// receives or stores the recording, only the words, which appear in the box to check before
// sending. It keeps listening through pauses until the student taps Stop (founder, 2026-11-06). Browsers without it (for example Firefox) simply show no button.

const noSubscription = () => () => {};

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
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  if (!supported) return null;

  // Keeps listening through pauses until Stop is tapped (see dictate in recognition.ts).
  function start() {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    setListening(true);
    stopRef.current = dictate(Constructor, {
      onText,
      onError: (code) => onError(voiceErrorMessage(code)),
      onStop: () => {
        setListening(false);
        stopRef.current = null;
      },
    });
  }

  // While listening: a moving wave of bars beside a filled button that reads "Stop dictation".
  return (
    <span className="flex items-center gap-2">
      {listening && <VoiceWave className="text-ink" />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => (listening ? stopRef.current?.() : start())}
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
