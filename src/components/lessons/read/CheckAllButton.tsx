"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { finishReading } from "@/server/lessons/readInFull";

// One click per lesson (founder, 2026-11-06): after reading, tick every section not yet ticked as
// checked, approve the lesson as read in full and open the next. Never shown when a section is
// marked as a problem; the server refuses then too.
export function CheckAllButton({ lessonId, version, compact = false }: { lessonId: string; version: number; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function go() {
    setBusy(true);
    setMessage(undefined);
    const result = await finishReading({ lessonId, version, decision: "check-all" });
    if (!result.ok) {
      setBusy(false);
      return setMessage(result.message);
    }
    // The queue moves on to the next lesson still to read.
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" disabled={busy} onClick={() => void go()} className={compactPrimaryButton}>
        {busy ? "Approving…" : compact ? "All correct: approve and next" : "All correct: tick everything, approve and go to the next lesson"}
      </button>
      <FormAlert message={message} />
    </span>
  );
}
