"use client";

import { useState } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { readUploadUntilDone } from "./readUpload";

// Carries on reading a file that stopped (pages already read are kept).
export function TryReadingButton({ id, fileName, failed }: { id: string; fileName: string; failed: boolean }) {
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();

  async function run() {
    setMessage(undefined);
    setProgress("Reading…");
    const result = await readUploadUntilDone(id, setProgress);
    setProgress(null);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={progress !== null}
        onClick={() => void run()}
        className={`${compactSecondaryButton} self-start`}
        aria-label={`${failed ? "Try reading" : "Read"} ${fileName}${failed ? " again" : " now"}`}
      >
        {progress ?? (failed ? "Try again" : "Read now")}
      </button>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
