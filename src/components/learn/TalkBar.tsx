"use client";

import { Icon } from "@/components/ui/Icon";
import { VoiceWave } from "@/components/ui/VoiceWave";
import { useSpeechSupported } from "./recognition";
import type { Talk } from "./useTalkMode";

const STATUS: Record<Exclude<Talk, "off">, string> = {
  listening: "Listening… ask your question.",
  thinking: "Searching the library and writing…",
  speaking: "Speaking…",
};

// Shown while voice mode is on: what Lawdeck is doing, and a button to end it.
export function TalkBar({ talk, offering, onEnd }: { talk: Talk; offering: boolean; onEnd: () => void }) {
  if (talk === "off") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm"
    >
      {talk === "listening" ? (
        <VoiceWave className="text-ink" />
      ) : (
        <Icon name={talk === "speaking" ? "speaker" : "waveform"} size={18} className="shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        {talk === "listening" && offering
          ? "Say “yes” to hear the full explanation, or ask another question."
          : STATUS[talk]}
      </span>
      <button
        type="button"
        onClick={onEnd}
        aria-label="End voice mode"
        className="inline-flex h-9 shrink-0 items-center rounded-full border border-line px-3 text-ink hover:bg-pill"
      >
        <span className="sm:hidden">End</span>
        <span className="hidden sm:inline">End voice mode</span>
      </button>
    </div>
  );
}

// Starts voice mode. Shown only where the browser understands speech and the voice is set up.
export function TalkButton({
  onClick,
  disabled,
  compact = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const supported = useSpeechSupported();
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Voice mode: talk with Lawdeck"
      title="Voice mode"
      className={`flex ${compact ? "size-9 sm:size-10" : "size-11"} shrink-0 items-center justify-center rounded-full bg-pill text-ink disabled:opacity-40`}
    >
      <Icon name="waveform" size={compact ? 17 : 18} />
    </button>
  );
}
