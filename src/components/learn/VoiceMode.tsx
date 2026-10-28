"use client";

import { Icon } from "@/components/ui/Icon";
import { VoiceWave } from "@/components/ui/VoiceWave";
import { useSpeechSupported } from "./recognition";
import { useVoiceConversation, type Talk } from "./useVoiceConversation";

type ChatFor = Parameters<typeof useVoiceConversation>[0]["chatFor"];

const STATUS: Record<Exclude<Talk, "off">, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Tap to interrupt",
};

// The sound-wave button and the full-screen voice conversation it opens (founder, 2026-10-28:
// "you press it, say something, it responds immediately there; it doesn't leave"). The screen
// stays where it is; afterwards the conversation is saved as a chat. onEnded gets the chat and
// any message to show (for example why voice mode stopped).
export function VoiceMode({
  chatFor,
  onEnded,
  compact = false,
  disabled,
}: {
  chatFor: ChatFor;
  onEnded?: (chatId: string | null, note: string | null) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const supported = useSpeechSupported();
  const voice = useVoiceConversation({ chatFor, onEnded });
  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={voice.begin}
        disabled={disabled}
        aria-label="Voice mode: talk with Lawdeck"
        title="Voice mode"
        className={`flex ${compact ? "size-9 sm:size-10" : "size-11"} shrink-0 items-center justify-center rounded-full bg-pill text-ink disabled:opacity-40`}
      >
        <Icon name="waveform" size={compact ? 17 : 18} />
      </button>
      {voice.talk !== "off" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Voice mode"
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-paper px-6 pb-10 pt-16 text-ink"
        >
          <p className="text-sm text-muted">Voice mode</p>
          <button
            type="button"
            onClick={voice.interrupt}
            aria-label={voice.talk === "speaking" ? "Interrupt Lawdeck" : STATUS[voice.talk]}
            className="flex flex-col items-center gap-6"
          >
            <span
              className={`flex size-40 items-center justify-center rounded-full bg-ink text-on-ink sm:size-48 ${
                voice.talk === "listening" ? "voice-orb-listening" : voice.talk === "thinking" ? "voice-orb-thinking" : ""
              }`}
            >
              {voice.talk === "speaking" && <VoiceWave className="h-10 scale-150" />}
            </span>
            <span className="text-lg" aria-live="polite">
              {STATUS[voice.talk]}
            </span>
          </button>
          <div className="flex w-full max-w-md flex-col items-center gap-4">
            {voice.heard && <p className="line-clamp-2 text-center text-sm text-muted">“{voice.heard}”</p>}
            <button
              type="button"
              onClick={voice.end}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-6 text-[15px] hover:bg-pill"
            >
              <Icon name="close" size={16} />
              End
            </button>
          </div>
        </div>
      )}
    </>
  );
}
