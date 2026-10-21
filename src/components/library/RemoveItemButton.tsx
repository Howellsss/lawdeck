"use client";

import { useState, useTransition } from "react";
import { compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { removeLibraryItem } from "@/server/library/actions";

// Two steps: "Remove", then a clear confirmation. Removing deletes the file and its passages.
export function RemoveItemButton({ id, title }: { id: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-warning underline underline-offset-2">
        Remove<span className="sr-only"> {title}</span>
      </button>
    );
  }

  return (
    <div role="group" aria-label={`Remove ${title}?`} className="flex flex-col gap-2">
      <p className="text-sm">Remove for good? The file and its passages are deleted.</p>
      {message && <p role="alert" className="text-sm text-warning">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await removeLibraryItem(id);
              if (!result.ok) setMessage(result.message);
            })
          }
          className={compactWarningButton}
        >
          {pending ? "Removing…" : "Yes, remove"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={compactSecondaryButton}>
          Cancel
        </button>
      </div>
    </div>
  );
}
