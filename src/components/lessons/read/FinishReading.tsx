"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import type { ReadingState } from "@/lib/readInFull";
import { CheckAllButton } from "./CheckAllButton";
import { finishReading } from "@/server/lessons/readInFull";

// The end of a lesson read in full: approve (every section checked) or send it back with the
// problems as its note. The server checks the ticks again before either.
export function FinishReading({
  lessonId,
  version,
  state,
  nextHref,
  sectionCount,
}: {
  lessonId: string;
  version: number;
  state: ReadingState;
  nextHref: string | null;
  sectionCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "warning" | "success"; message: string } | null>(null);

  async function finish(decision: "approve" | "send-back") {
    setBusy(true);
    setNotice(null);
    const result = await finishReading({ lessonId, version, decision });
    setBusy(false);
    if (!result.ok) return setNotice({ tone: "warning", message: result.message });
    setNotice({ tone: "success", message: decision === "approve" ? "Approved as read in full. Students no longer see the note." : "Sent back with your notes." });
    router.refresh();
  }

  return (
    <section aria-labelledby="finish" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 id="finish" className="text-lg font-medium">
        Finish this lesson
      </h2>
      {state.missing.length > 0 ? (
        <p className="text-sm text-muted">
          Tick every section to finish. Still to tick: {state.missing.map((i) => (i === sectionCount ? "the test" : `section ${i + 1}`)).join(", ")}.
        </p>
      ) : state.problems.length > 0 ? (
        <p className="text-sm text-muted">
          {state.problems.length} section{state.problems.length === 1 ? " has" : "s have"} a problem. Send the lesson back: it leaves students until it is
          fixed and approved again.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Everything is checked. Memory aids and stories are reviewed separately on the lesson&rsquo;s full page.
        </p>
      )}
      {state.missing.length > 0 && state.problems.length === 0 && <CheckAllButton lessonId={lessonId} version={version} />}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !state.canApprove} onClick={() => void finish("approve")} className={compactPrimaryButton}>
          Approve as read in full
        </button>
        {state.canSendBack && (
          <button type="button" disabled={busy} onClick={() => void finish("send-back")} className={compactSecondaryButton}>
            Send back for a fix
          </button>
        )}
        {nextHref && (
          <Link href={nextHref} className="text-sm">
            Skip to the next lesson
          </Link>
        )}
      </div>
      <FormAlert message={notice?.message} tone={notice?.tone} />
    </section>
  );
}
