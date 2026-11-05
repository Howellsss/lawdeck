"use client";

import { useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactPrimaryButton, compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { decideLesson } from "@/server/lessons/actions";

// A reviewer's decision: approve (students see it), reject with a note, or withdraw an approved
// lesson. The database records who decided and when.
export function LessonDecision({ lessonId, status, note, bulkApproved = false }: { lessonId: string; status: string; note: string | null; bulkApproved?: boolean }) {
  const [text, setText] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function decide(next: "approved" | "rejected" | "withdrawn" | "pending") {
    setBusy(true);
    setMessage(undefined);
    const result = await decideLesson({ lessonId, status: next, note: text });
    setBusy(false);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <section aria-labelledby="decision" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 id="decision" className="text-lg font-medium">
        Decision
      </h2>
      <p className="text-sm text-muted">
        Check every section, authority card and question against the library before approving. Students only see approved lessons.
      </p>
      <label htmlFor="review-note" className="text-sm font-medium">
        Note (optional)
      </label>
      <textarea
        id="review-note"
        rows={3}
        maxLength={2000}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="rounded-xl border border-line bg-paper px-3 py-2 text-[15px]"
      />
      <FormAlert message={message} />
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && (
          <button type="button" disabled={busy} onClick={() => void decide("approved")} className={compactPrimaryButton}>
            Approve
          </button>
        )}
        {status !== "rejected" && status !== "approved" && (
          <button type="button" disabled={busy} onClick={() => void decide("rejected")} className={compactSecondaryButton}>
            Reject
          </button>
        )}
        {status === "approved" && bulkApproved && (
          <button type="button" disabled={busy} onClick={() => void decide("approved")} className={compactPrimaryButton}>
            I have read it in full
          </button>
        )}
        {status === "approved" && (
          <button type="button" disabled={busy} onClick={() => void decide("withdrawn")} className={compactWarningButton}>
            Withdraw from students
          </button>
        )}
        {(status === "rejected" || status === "withdrawn") && (
          <button type="button" disabled={busy} onClick={() => void decide("pending")} className={compactSecondaryButton}>
            Back to awaiting review
          </button>
        )}
      </div>
    </section>
  );
}
