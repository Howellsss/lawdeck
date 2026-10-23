"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactWarningButton } from "@/components/ui/buttons";
import { deleteDocument } from "@/server/drafting/actions";

// Deletes a document and all its versions after a confirmation.
export function DeleteDocumentButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function remove() {
    setBusy(true);
    const result = await deleteDocument(id);
    if (result.ok) {
      router.push("/documents");
      router.refresh();
      return;
    }
    setBusy(false);
    setMessage(result.message);
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={compactWarningButton}>
        Delete this document
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm">Delete this document? This can’t be undone.</span>
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
