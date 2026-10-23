"use client";

import { useState } from "react";
import {
  compactSecondaryButton,
  compactWarningButton,
} from "@/components/ui/buttons";
import { deleteUpload } from "@/server/uploads/actions";

// Delete one file, after a second tap to confirm. It leaves storage and search at once (UP-05).
export function DeleteUploadButton({
  id,
  fileName,
}: {
  id: string;
  fileName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function remove() {
    setBusy(true);
    const result = await deleteUpload(id);
    setBusy(false);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className={compactWarningButton}
          >
            {busy ? "Deleting…" : "Yes, delete it"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
            className={compactSecondaryButton}
          >
            Keep it
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`${compactSecondaryButton} self-start`}
          aria-label={`Delete ${fileName}`}
        >
          Delete
        </button>
      )}
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
