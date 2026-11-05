"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeSavedAid } from "@/server/study/aids";

// Takes one aid out of the student's saved memory aids (the list on the topic and in the diary).
export function RemoveSavedAid({ savedId, title }: { savedId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        aria-label={`Remove “${title}” from my memory aids`}
        onClick={async () => {
          setBusy(true);
          const result = await removeSavedAid({ savedId });
          setBusy(false);
          if (!result.ok) return setError(result.message);
          router.refresh();
        }}
        className="text-sm text-muted underline underline-offset-2 disabled:opacity-60"
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
