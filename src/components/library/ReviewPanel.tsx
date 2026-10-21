"use client";

import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { FieldErrors } from "@/lib/fieldErrors";
import { REVIEW_STATUS_LABELS } from "@/lib/libraryLabels";
import { reviewLibraryItem } from "@/server/library/review";

type Status = keyof typeof REVIEW_STATUS_LABELS;

const CHOICES: { value: Status; label: string; hint: string }[] = [
  { value: "approved", label: "Approve", hint: "Answers may use this material." },
  { value: "rejected", label: "Reject", hint: "Never used." },
  { value: "withdrawn", label: "Withdraw", hint: "Stop using it straight away." },
  { value: "pending", label: "Awaiting review", hint: "Not decided yet." },
];

// The reviewer's decision on an item, with the "law current as of" date (rule KB-02) and a note.
export function ReviewPanel({
  id,
  status,
  lawCurrentAsOf,
  note,
  blockers,
  today,
}: {
  id: string;
  status: Status;
  lawCurrentAsOf: string | null;
  note: string | null;
  blockers: string[];
  today: string;
}) {
  const [choice, setChoice] = useState<Status>(status);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ tone: "success" | "warning"; message: string }>();
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const saved = await reviewLibraryItem({
        id,
        status: choice,
        lawCurrentAsOf: String(form.get("lawCurrentAsOf") ?? ""),
        note: String(form.get("note") ?? ""),
      });
      setErrors(saved.ok ? {} : (saved.fieldErrors ?? {}));
      setResult(saved.message ? { tone: saved.ok ? "success" : "warning", message: saved.message } : undefined);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-lg font-medium">Decision</h2>
      <FormAlert message={result?.message} tone={result?.tone} />
      {blockers.length > 0 && (
        <p className="rounded-2xl border border-line px-4 py-3 text-sm text-muted">
          Before this can be approved: {blockers.join(" ")}
        </p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 px-1 text-sm font-medium">Status</legend>
        {CHOICES.map((option) => (
          <label key={option.value} className="flex items-start gap-3 rounded-2xl border border-line px-4 py-3">
            <input
              type="radio"
              name="status"
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              disabled={option.value === "approved" && blockers.length > 0}
              className="mt-1 accent-ink"
            />
            <span>
              <span className="block text-[15px] font-medium">{option.label}</span>
              <span className="block text-sm text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <TextField
        label={choice === "approved" ? "Law current as of" : "Law current as of (optional)"}
        name="lawCurrentAsOf"
        type="date"
        max={today}
        defaultValue={lawCurrentAsOf ?? ""}
        hint="The date up to which you have checked that this material reflects the law."
        error={errors.lawCurrentAsOf}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-note" className="px-1 text-sm font-medium">
          Note (optional)
        </label>
        <textarea
          id="review-note"
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={note ?? ""}
          aria-invalid={errors.note ? true : undefined}
          className="rounded-2xl border border-line bg-sidebar px-4 py-3 text-[15px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-ink"
          placeholder="e.g. Order 2 updated by the 2024 rules"
        />
        {errors.note && <p className="px-1 text-sm text-warning">{errors.note}</p>}
      </div>
      <div>
        <button type="submit" disabled={pending} className={compactPrimaryButton}>
          {pending ? "Saving…" : "Save decision"}
        </button>
      </div>
    </form>
  );
}
