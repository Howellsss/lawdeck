"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeSavedAid, saveMemoryAid } from "@/server/study/aids";

// Save a memory aid to "My remembrance tools" (shown on the topic and in the Study Diary), or take
// it out again.
export function SaveAidButton({ aidId, saved: initial, title }: { aidId: string; saved: boolean; title: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function toggle() {
    setBusy(true);
    setError(undefined);
    const result = saved ? await removeSavedAid({ aidId }) : await saveMemoryAid({ aidId });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setSaved(!saved);
    // The topic's "Your saved memory aids" list shows the change.
    router.refresh();
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? `Remove “${title}” from my memory aids` : `Save “${title}” to my memory aids`}
        onClick={() => void toggle()}
        className={`rounded-full border px-3 py-1 text-sm ${saved ? "border-success text-success" : "border-line"} disabled:opacity-60`}
      >
        {busy ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-warning">
          {error}
        </span>
      )}
    </span>
  );
}
