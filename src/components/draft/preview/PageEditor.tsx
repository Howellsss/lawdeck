"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { Spinner } from "@/components/ui/Spinner";
import type { EditablePartView } from "@/server/db/documents";
import { changePart } from "@/server/drafting/editActions";

// Editing on the page (founder, 2026-10-25): the wording of the paragraph the student clicked,
// saved as a new version (no AI). Words in {{double braces}} come from the facts.
export function PageEditor({ documentId, part, onDone }: { documentId: string; part: EditablePartView; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const label = part.heading ?? "This paragraph";

  async function save(text: string | null) {
    setBusy(true);
    setMessage(undefined);
    const result = await changePart({ documentId, partId: part.id, text });
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    if (result.changed) router.refresh();
    onDone();
  }

  return (
    <form
      action={(form) => void save(String(form.get("text") ?? ""))}
      className="sticky top-0 z-10 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-lg"
    >
      <label htmlFor={`page-edit-${part.id}`} className="text-sm font-medium">
        Change the wording: {label}
      </label>
      <textarea
        id={`page-edit-${part.id}`}
        name="text"
        autoFocus
        defaultValue={part.text}
        rows={Math.min(12, Math.max(3, part.text.split("\n").length + 1))}
        maxLength={20000}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[15px] text-ink"
      />
      <p className="text-xs text-muted">
        One paragraph per line. Words in {"{{double braces}}"} are filled in from your facts; to change a date, name or sum, use
        the grey boxes or Facts. Each save is a new version you can go back to.
      </p>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={compactPrimaryButton}>
          {busy ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Saving…
            </span>
          ) : (
            "Save"
          )}
        </button>
        <button type="button" disabled={busy} onClick={onDone} className={compactSecondaryButton}>
          Cancel
        </button>
        {part.edited && (
          <button type="button" disabled={busy} onClick={() => void save(null)} className="text-sm underline underline-offset-2">
            Put back the original wording
          </button>
        )}
      </div>
    </form>
  );
}
