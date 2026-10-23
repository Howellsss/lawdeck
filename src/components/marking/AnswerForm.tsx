"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { ANSWER_MAX_CHARS } from "@/schemas/marking";
import { submitAnswerForMarking } from "@/server/marking/actions";

// The student writes their answer; Lawdeck marks it against the approved guide (PRD LN-08).
export function AnswerForm({ rubricId }: { rubricId: string }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit() {
    setBusy(true);
    setMessage(undefined);
    const result = await submitAnswerForMarking({ rubricId, answer });
    if (result.ok) {
      router.push(`/practice/${result.setId}?marked=1`);
      return;
    }
    setBusy(false);
    setMessage(result.message);
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="font-medium">Your answer</span>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={14}
          maxLength={ANSWER_MAX_CHARS}
          required
          className="rounded-xl border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed"
        />
        <span className="text-sm text-muted">
          {answer.length.toLocaleString("en-GB")} / {ANSWER_MAX_CHARS.toLocaleString("en-GB")} characters. Write as you would in the exam: issue, rule
          with authority, application, conclusion.
        </span>
      </label>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={compactPrimaryButton}>
          {busy ? "Marking your answer…" : "Mark my answer"}
        </button>
        {busy && (
          <span role="status" className="text-sm text-muted">
            This can take up to a minute.
          </span>
        )}
      </div>
      <p className="text-sm text-muted">Each marked answer counts as one of your questions this month.</p>
    </form>
  );
}
