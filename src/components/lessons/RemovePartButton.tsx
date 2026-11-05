"use client";

import { useState } from "react";
import { removeLessonPart } from "@/server/lessons/actions";

// Removes one question, authority card, memory aid or story a reviewer finds wrong. It goes back to review.
export function RemovePartButton({ kind, id, label }: { kind: "checkpoint" | "authority" | "aid" | "story"; id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        aria-label={`Remove ${label}`}
        onClick={async () => {
          setBusy(true);
          const result = await removeLessonPart({ kind, id });
          setBusy(false);
          if (!result.ok) setError(result.message);
        }}
        className="text-sm text-warning underline underline-offset-2 disabled:opacity-60"
      >
        {busy ? "Removing…" : "Remove"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-warning">
          {error}
        </span>
      )}
    </span>
  );
}
