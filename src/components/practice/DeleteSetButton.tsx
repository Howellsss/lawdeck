"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactWarningButton } from "@/components/ui/buttons";
import { deletePracticeSet } from "@/server/practice/actions";

// Deletes a practice set, with its questions and answers, after a confirmation.
// On the set's own page it says "Delete this set"; in the MCQ list (founder, 2026-11-02: "students
// should be able to delete their MCQ") it is a short "Delete" named after the set for screen readers.
export function DeleteSetButton({ id, title }: { id: string; title?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function remove() {
    setBusy(true);
    const result = await deletePracticeSet(id);
    if (result.ok) {
      router.push("/practice");
      router.refresh();
      return;
    }
    setBusy(false);
    setMessage(result.message);
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={title ? `Delete ${title}` : undefined}
        className={compactWarningButton}
      >
        {title ? "Delete" : "Delete this set"}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm">Delete this set and your answers? This can’t be undone.</span>
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
