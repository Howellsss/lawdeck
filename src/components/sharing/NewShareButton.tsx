"use client";

import { useState } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import type { ShareKind } from "@/schemas/sharing";
import { createShare } from "@/server/sharing/actions";

// Makes a new view-only link to the student's document or project.
export function NewShareButton({ kind, id }: { kind: ShareKind; id: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function create() {
    setBusy(true);
    setMessage(undefined);
    const result = await createShare(kind, id);
    setBusy(false);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={busy} onClick={() => void create()} className={`${compactSecondaryButton} self-start`}>
        {busy ? "Making a link…" : "Make a view-only link"}
      </button>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
