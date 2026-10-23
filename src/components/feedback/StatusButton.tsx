"use client";

import { useState } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { setReportStatus, setTakedownStatus } from "@/server/feedback/actions";

// Reviewers close a report or takedown request, or open it again.
export function StatusButton({ kind, id, closed }: { kind: "report" | "takedown"; id: string; closed: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const label = closed ? "Open again" : kind === "report" ? "Mark resolved" : "Mark done";

  async function change() {
    setBusy(true);
    setMessage(undefined);
    const result =
      kind === "report" ? await setReportStatus(id, closed ? "open" : "resolved") : await setTakedownStatus(id, closed ? "open" : "done");
    setBusy(false);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" disabled={busy} onClick={() => void change()} className={`${compactSecondaryButton} self-start`}>
        {busy ? "Saving…" : label}
      </button>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
