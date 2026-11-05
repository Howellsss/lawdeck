"use client";

import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import type { Annotation, AnnotationStyle } from "@/lib/annotations";
import type { Pending } from "./useAnnotations";

const STYLES: { style: AnnotationStyle; label: string }[] = [
  { style: "highlight", label: "Highlight" },
  { style: "circle", label: "Circle" },
  { style: "underline", label: "Underline" },
];

// The bar that appears at the bottom of the screen when the student selects words in a lesson, or
// taps one of their marks (founder's brief, section 30): highlight, circle, underline, a note, or
// remove. Saved straight away. Fixed at the bottom so it works the same on phones.
export function AnnotationBar({
  pending,
  editing,
  error,
  onAdd,
  onChange,
  onRemove,
  onClose,
}: {
  pending: Pending | null;
  editing: Annotation | null;
  error?: string;
  onAdd: (style: AnnotationStyle, note?: string) => Promise<void>;
  onChange: (id: string, style: AnnotationStyle, note: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const target = editing ?? pending;
  const [note, setNote] = useState(editing?.note ?? "");
  const [writing, setWriting] = useState(Boolean(editing?.note));
  const [busy, setBusy] = useState(false);
  if (!target) return null;
  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    await job();
    setBusy(false);
  };
  const quote = target.quote.length > 60 ? `${target.quote.slice(0, 60)}…` : target.quote;

  return (
    <div role="dialog" aria-label={editing ? "Your mark" : "Mark these words"} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper px-4 py-3 shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm text-muted">
            {editing ? "Your mark on" : "Mark"} &ldquo;{quote}&rdquo;
          </p>
          <button type="button" onClick={onClose} className="text-sm text-muted underline underline-offset-2">
            Close
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STYLES.map(({ style, label }) => (
            <button
              key={style}
              type="button"
              disabled={busy}
              aria-pressed={editing?.style === style}
              onClick={() => void run(() => (editing ? onChange(editing.id, style, note) : onAdd(style, writing ? note : "")))}
              className={editing?.style === style ? compactPrimaryButton : compactSecondaryButton}
            >
              {label}
            </button>
          ))}
          {!writing && (
            <button type="button" onClick={() => setWriting(true)} className={compactSecondaryButton}>
              {editing?.note ? "Edit note" : "Add a note"}
            </button>
          )}
          {editing && (
            <button type="button" disabled={busy} onClick={() => void run(() => onRemove(editing.id))} className="text-sm text-warning underline underline-offset-2">
              Remove
            </button>
          )}
        </div>
        {writing && (
          <div className="flex flex-col gap-2">
            <label htmlFor="annotation-note" className="text-sm font-medium">
              Your note
            </label>
            <textarea
              id="annotation-note"
              rows={2}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-[16px]"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => (editing ? onChange(editing.id, editing.style, note) : onAdd("highlight", note)))}
              className={`${compactPrimaryButton} self-start`}
            >
              {editing ? "Save note" : "Highlight with this note"}
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-warning">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
