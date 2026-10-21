"use client";

import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import type { FieldErrors } from "@/lib/fieldErrors";
import type { ReviewPassage } from "@/server/db/library";
import { correctPassage } from "@/server/library/review";

function pages(passage: ReviewPassage) {
  if (!passage.pageFrom) return null;
  return passage.pageTo && passage.pageTo !== passage.pageFrom
    ? `Pages ${passage.pageFrom}–${passage.pageTo}`
    : `Page ${passage.pageFrom}`;
}

// One passage: read it, and correct its heading or wording if needed.
export function PassageCard({ passage }: { passage: ReviewPassage }) {
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ tone: "success" | "warning"; message: string }>();
  const [pending, startTransition] = useTransition();
  const label = `Passage ${passage.position + 1}`;

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const saved = await correctPassage({
        passageId: passage.id,
        heading: String(form.get("heading") ?? ""),
        text: String(form.get("text") ?? ""),
      });
      setErrors(saved.ok ? {} : (saved.fieldErrors ?? {}));
      setResult(saved.message ? { tone: saved.ok ? "success" : "warning", message: saved.message } : undefined);
      if (saved.ok) setEditing(false);
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-4">
      <p className="text-sm text-muted">
        {[label, pages(passage), passage.indexed ? null : "not indexed for search"].filter(Boolean).join(" · ")}
      </p>
      <FormAlert message={result?.message} tone={result?.tone} />
      {editing ? (
        <form onSubmit={save} noValidate className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-medium">Heading (optional)</span>
            <input
              name="heading"
              defaultValue={passage.heading ?? ""}
              maxLength={500}
              className="h-12 rounded-2xl border border-line bg-sidebar px-4 text-[15px] text-ink"
            />
            {errors.heading && <span className="px-1 text-sm text-warning">{errors.heading}</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-medium">Wording</span>
            <textarea
              name="text"
              defaultValue={passage.text}
              rows={10}
              maxLength={20000}
              className="rounded-2xl border border-line bg-sidebar px-4 py-3 text-[15px] leading-relaxed text-ink"
            />
            {errors.text && <span className="px-1 text-sm text-warning">{errors.text}</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={compactPrimaryButton}>
              {pending ? "Saving…" : "Save correction"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className={compactSecondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {passage.heading && <p className="text-[15px] font-medium">{passage.heading}</p>}
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{passage.text}</p>
          <div>
            <button type="button" onClick={() => setEditing(true)} className="text-sm underline underline-offset-2">
              Correct<span className="sr-only"> {label}</span>
            </button>
          </div>
        </>
      )}
    </li>
  );
}
