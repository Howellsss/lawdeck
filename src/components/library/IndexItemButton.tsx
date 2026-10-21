"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { indexUntilDone } from "./readItem";

// Admins give an item's passages search vectors (or finish an interrupted run).
export function IndexItemButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("Indexing for search…");
  const [message, setMessage] = useState<string>();

  async function index() {
    setBusy(true);
    setMessage(undefined);
    setProgress("Indexing for search…");
    const result = await indexUntilDone(id, (step) =>
      setProgress(`Indexing for search… ${step.indexed} of ${step.total} passages.`),
    );
    setBusy(false);
    if (!result.ok) setMessage(result.message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={busy} onClick={index} className={compactSecondaryButton}>
        {busy ? "Indexing…" : "Index for search"}
        <span className="sr-only"> {title}</span>
      </button>
      {busy && (
        <p role="status" className="text-sm text-muted">
          {progress} Keep this page open.
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
