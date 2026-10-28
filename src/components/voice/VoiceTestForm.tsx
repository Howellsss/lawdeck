"use client";

import { useRef, useState, type FormEvent } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { VOICE_TEST_MAX_CHARS, type Voice } from "@/schemas/voice";

// Admin → Voice test: type a name or sentence and hear Lawdeck say it, to find names for the
// pronunciation list.
export function VoiceTestForm() {
  const [text, setText] = useState("Agbonmagbe Bank Ltd v. General Manager, G. B. Ollivant (Nig.) Ltd & Anor");
  const [voice, setVoice] = useState<Voice>("female");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function listen(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/speech/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Lawdeck’s voice is not available right now.");
        return;
      }
      const audio = audioRef.current;
      if (audio) {
        if (audio.src) URL.revokeObjectURL(audio.src);
        audio.src = URL.createObjectURL(await response.blob());
        await audio.play().catch(() => setError("Press play on the player below."));
      }
    } catch {
      setError("Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={listen} className="flex flex-col gap-3">
      <label htmlFor="voice-text" className="text-sm font-medium">
        Text to hear
      </label>
      <textarea
        id="voice-text"
        rows={3}
        maxLength={VOICE_TEST_MAX_CHARS}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="rounded-xl border border-line bg-surface px-3 py-2 text-[16px] text-ink"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Voice
          <select
            value={voice}
            onChange={(event) => setVoice(event.target.value as Voice)}
            className="h-10 rounded-full border border-line bg-surface px-3 text-[16px] text-ink"
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <button type="submit" disabled={busy || !text.trim()} className={compactPrimaryButton}>
          {busy ? "Preparing…" : "Listen"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      )}
      <audio ref={audioRef} controls className="w-full max-w-md" />
    </form>
  );
}
