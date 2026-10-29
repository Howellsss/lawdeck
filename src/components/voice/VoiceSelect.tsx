"use client";

import { useId, useSyncExternalStore } from "react";
import { readVoice, saveVoice, subscribeVoice } from "@/lib/voicePreference";
import { VOICE_LABELS, VOICE_SHORT_LABELS, VOICES, type Voice } from "@/schemas/voice";

// A small voice menu where the voice is used (founder, 2026-10-29: "at what point does the student
// choose the voice"): in voice mode and beside Read. The same choice as on the Account page.
export function VoiceSelect({ className = "" }: { className?: string }) {
  const id = useId();
  const voice = useSyncExternalStore(subscribeVoice, readVoice, () => null);
  if (!voice) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm text-muted ${className}`}>
      <label htmlFor={id}>Voice</label>
      <select
        id={id}
        value={voice}
        onChange={(event) => saveVoice(event.target.value as Voice)}
        className="h-9 rounded-full border border-line bg-paper px-3 text-sm text-ink"
      >
        {VOICES.map((option) => (
          <option key={option} value={option} title={VOICE_LABELS[option]}>
            {VOICE_SHORT_LABELS[option]}
          </option>
        ))}
      </select>
    </span>
  );
}
