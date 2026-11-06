"use client";

import { useId, useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { reportMessage } from "@/server/chat/moderation";

const REASONS = [
  ["abuse", "Rude, bullying or vulgar"],
  ["contact", "Shares contact details or asks for them"],
  ["cheating", "Exam cheating or leaked papers"],
  ["spam", "Spam or advertising"],
  ["other", "Something else"],
] as const;
type Reason = (typeof REASONS)[number][0];

// Report a message to the admins, with a reason and an optional note. Each person reports a message once.
export function ReportForm({ messageId, onDone }: { messageId: string; onDone: (sent: string | null) => void }) {
  const id = useId();
  const [reason, setReason] = useState<Reason>();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return setError("Choose a reason.");
    setBusy(true);
    setError(undefined);
    const result = await reportMessage({ id: messageId, reason, note });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone("Thanks. An admin will look at this message.");
  };
  return (
    <form onSubmit={(e) => void send(e)} className="mt-2 flex max-w-md flex-col gap-2 rounded-xl border border-line bg-paper p-3" aria-label="Report this message">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[14px] font-medium">Why are you reporting this message?</legend>
        {REASONS.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-[14px]">
            <input type="radio" name={`${id}-reason`} value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-ink" />
            {label}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`${id}-note`} className="text-[13px] text-muted">
        Anything else the admin should know {reason === "other" ? "(needed)" : "(optional)"}
      </label>
      <textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[15px]" />
      {error && (
        <p role="alert" className="text-[13px] text-warning">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={compactPrimaryButton}>
          {busy ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => onDone(null)} className={compactSecondaryButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
