"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import type { LibraryItemSummary } from "@/server/db/library";
import { progressText, readUntilDone } from "./readItem";

const LABELS = {
  waiting: "Read file",
  reading: "Continue reading",
  failed: "Try again",
  done: "Read again",
} as const;

// Admins start, continue or redo reading an item's file into passages.
export function ReadItemButton({ id, title, status }: { id: string; title: string; status: LibraryItemSummary["reading"]["status"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("Reading…");
  const [message, setMessage] = useState<string>();

  async function read() {
    setBusy(true);
    setMessage(undefined);
    setProgress("Reading…");
    // "Continue reading" carries on; every other choice starts from the first page.
    const result = await readUntilDone(id, status !== "reading", (step) => setProgress(progressText(step)));
    setBusy(false);
    if (!result.ok) setMessage(result.message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={busy} onClick={read} className={compactSecondaryButton}>
        {busy ? "Reading…" : LABELS[status]}
        <span className="sr-only"> {title}</span>
      </button>
      {busy && (
        <p role="status" className="text-sm text-muted">
          {progress}. Keep this page open.
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
