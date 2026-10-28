"use client";

import { useState, useSyncExternalStore } from "react";
import { readVoice, saveVoice } from "@/lib/voicePreference";
import type { Voice } from "@/schemas/voice";

const LABELS: Record<Voice, string> = { female: "Female voice", male: "Male voice" };
const noSubscription = () => () => {};

// The voice that reads answers aloud (founder, 2026-10-28: students choose). Saved in this browser.
export function VoicePicker() {
  const saved = useSyncExternalStore(noSubscription, readVoice, () => null);
  const [chosen, setChosen] = useState<Voice | null>(null);
  const current = chosen ?? saved;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Reading voice</legend>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as Voice[]).map((voice) => (
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
              onChange={() => {
                saveVoice(voice);
                setChosen(voice);
              }}
              className="sr-only"
            />
            {LABELS[voice]}
          </label>
        ))}
      </div>
      <p className="text-sm text-muted">Both are Nigerian English voices. Your choice is saved on this device.</p>
    </fieldset>
  );
}
