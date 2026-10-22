"use client";

import { useState, useTransition } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { rateEvalAnswer } from "@/server/eval/actions";

type Rating = "approved" | "needs_fix";

// The legal reviewer's verdict on one test answer: Approve or Needs fix, with an optional note.
export function RateAnswerForm(props: { id: string; label: string; rating: Rating | null; note: string | null }) {
  const [rating, setRating] = useState<Rating | null>(props.rating);
  const [note, setNote] = useState(props.note ?? "");
  const [message, setMessage] = useState<{ tone: "success" | "warning"; text: string }>();
  const [pending, startTransition] = useTransition();
  const name = `rating-${props.id}`;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!rating) return setMessage({ tone: "warning", text: "Choose Approve or Needs fix." });
    startTransition(async () => {
      const result = await rateEvalAnswer({ id: props.id, rating, note });
      setMessage(result.ok ? { tone: "success", text: "Saved." } : { tone: "warning", text: result.message });
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line pt-3" aria-label={`Rate ${props.label}`}>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Your verdict on {props.label}</legend>
        {(
          [
            ["approved", "Approve"],
            ["needs_fix", "Needs fix"],
          ] as const
        ).map(([value, text]) => (
          <label key={value} className="flex min-h-11 items-center gap-2 text-[15px]">
            <input type="radio" name={name} value={value} checked={rating === value} onChange={() => setRating(value)} className="size-5" />
            {text}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Note (what is wrong or missing)
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={2000}
          className="rounded-xl border border-line bg-paper px-3 py-2 text-[15px] text-ink"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={compactPrimaryButton}>
          {pending ? "Saving…" : "Save verdict"}
        </button>
        {message && (
          <p role="status" className={`text-sm ${message.tone === "success" ? "text-success" : "text-warning"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
