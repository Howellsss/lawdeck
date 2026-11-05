"use client";

import type { Annotation } from "@/lib/annotations";

// Marks whose words are no longer in the updated lesson: kept, never lost (Phase 3a).
export function EarlierNotes({ notes, onRemove }: { notes: Annotation[]; onRemove: (id: string) => Promise<void> }) {
  if (notes.length === 0) return null;
  return (
    <details className="rounded-2xl border border-line px-4 py-3">
      <summary className="cursor-pointer text-[15px] font-medium">Your marks from an earlier version of this lesson ({notes.length})</summary>
      <ul className="mt-3 flex flex-col gap-2 text-[15px]">
        {notes.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-3 border-t border-line pt-2 first:border-0 first:pt-0">
            <span className="min-w-0">
              &ldquo;{n.quote}&rdquo;
              {n.note && <span className="block text-sm text-muted">Your note: {n.note}</span>}
            </span>
            <button type="button" onClick={() => void onRemove(n.id)} className="shrink-0 text-sm text-muted underline underline-offset-2">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
