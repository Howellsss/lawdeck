"use client";

import { useId, useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { REPORT_CATEGORIES, REPORT_NOTE_MAX, type ReportCategory, type ReportTarget } from "@/schemas/feedback";
import { reportProblem } from "@/server/feedback/actions";

// "Report a problem" (PRD FB-01): one tap opens the five choices and an optional note; the
// review team sees the report with what it is about.
export function ReportProblem({ kind, id }: { kind: ReportTarget; id: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string>();
  const formId = useId();

  if (sent)
    return (
      <p role="status" className="text-sm text-muted">
        Thank you. The review team will check it.
      </p>
    );
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-sm text-muted underline underline-offset-2">
        Report a problem
      </button>
    );

  async function send() {
    if (!category) {
      setMessage("Choose what is wrong.");
      return;
    }
    setBusy(true);
    const result = await reportProblem({ kind, id, category, note });
    setBusy(false);
    if (result.ok) setSent(true);
    else setMessage(result.message);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">What is wrong?</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REPORT_CATEGORIES) as ReportCategory[]).map((key) => (
            <label
              key={key}
              className={`inline-flex h-11 cursor-pointer items-center rounded-full border px-4 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                category === key ? "border-ink bg-pill font-medium" : "border-line"
              }`}
            >
              <input
                type="radio"
                name={`${formId}-category`}
                value={key}
                checked={category === key}
                onChange={() => setCategory(key)}
                className="sr-only"
              />
              {REPORT_CATEGORIES[key]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Anything to add? (optional)
        <textarea
          value={note}
          maxLength={REPORT_NOTE_MAX}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-[15px]"
        />
      </label>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void send()} className={compactPrimaryButton}>
          {busy ? "Sending…" : "Send report"}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className={compactSecondaryButton}>
          Cancel
        </button>
      </div>
    </div>
  );
}
