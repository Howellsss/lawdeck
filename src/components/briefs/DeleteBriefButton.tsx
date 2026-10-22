"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactWarningButton } from "@/components/ui/buttons";
import { deleteBrief } from "@/server/briefs/actions";

// Deletes a brief after a confirmation.
export function DeleteBriefButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function remove() {
    setBusy(true);
    const result = await deleteBrief(id);
    if (result.ok) {
      router.push("/briefs");
      router.refresh();
      return;
    }
    setBusy(false);
    setMessage(result.message);
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={compactWarningButton}>
        Delete this brief
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm">Delete this brief? This can’t be undone.</span>
      <button type="button" disabled={busy} onClick={() => void remove()} className={compactWarningButton}>
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="text-sm underline underline-offset-2">
        Keep it
      </button>
      {message && (
        <p role="alert" className="w-full text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
