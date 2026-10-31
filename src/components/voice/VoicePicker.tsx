"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { readVoice, saveVoice, subscribeVoice } from "@/lib/voicePreference";
import { VOICE_LABELS, VOICES } from "@/schemas/voice";

// The voice that reads answers aloud and talks in voice mode (founder, 2026-10-28: students
// choose; 2026-10-29: British, American and Nigerian English). Saved in this browser.
export function VoicePicker() {
  const current = useSyncExternalStore(subscribeVoice, readVoice, () => null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function hear() {
    if (!current) return;
    setPlaying(true);
    setError(null);
    try {
      const response = await fetch("/api/speech/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: current }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Lawdeck’s voice is not available right now.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      audioRef.current ??= new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => URL.revokeObjectURL(url);
      await audioRef.current.play().catch(() => setError("Your browser blocked the sound. Tap again."));
    } catch {
      setError("Check your internet connection and try again.");
    } finally {
      setPlaying(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Reading voice</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {VOICES.map((voice) => (
          <label
            key={voice}
            className={`cursor-pointer rounded-full border px-4 py-2 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
              current === voice ? "border-ink bg-ink text-on-ink" : "border-line text-ink"
            }`}
          >
            <input
              type="radio"
              name="voice"
              value={voice}
              checked={current === voice}
              onChange={() => saveVoice(voice)}
              className="sr-only"
            />
            {VOICE_LABELS[voice]}
          </label>
        ))}
      </div>
      <button type="button" onClick={() => void hear()} disabled={playing || !current} className={`${compactSecondaryButton} self-start`}>
        {playing ? "Preparing…" : "Hear this voice"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      )}
      <p className="text-sm text-muted">Your choice is saved on this device. You can also change it in the side menu, in voice mode or beside Read.</p>
    </fieldset>
  );
}
