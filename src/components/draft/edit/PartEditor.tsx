"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import type { EditablePartView } from "@/server/db/documents";
import { changePart } from "@/server/drafting/editActions";

// One part's wording, rewritten by hand or put back to the original (DR-05). No AI.
export function PartEditor({ documentId, part, label }: { documentId: string; part: EditablePartView; label: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function save(text: string | null) {
    setBusy(true);
    setMessage(undefined);
    const result = await changePart({ documentId, partId: part.id, text });
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    setEditing(false);
    if (result.changed) router.refresh();
  }

  return (
    <li id={`part-${part.id}`} className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted">{part.edited ? "Your wording" : "Original wording"}</span>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="ml-auto text-sm underline underline-offset-2">
            Rewrite
          </button>
        )}
      </div>
      {editing ? (
        <form action={(form) => void save(String(form.get("text") ?? ""))} className="flex flex-col gap-2">
          <label htmlFor={`text-${part.id}`} className="sr-only">
            Wording of {label}
          </label>
          <textarea
            id={`text-${part.id}`}
            name="text"
            defaultValue={part.text}
            rows={Math.min(14, Math.max(4, part.text.split("\n").length + 2))}
            maxLength={20000}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink"
          />
          <p className="text-sm text-muted">Words in {"{{double braces}}"} are filled in from your facts. One paragraph per line.</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={compactPrimaryButton}>
              {busy ? "Saving…" : "Save wording"}
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)} className={compactSecondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        part.edited && (
          <button type="button" disabled={busy} onClick={() => void save(null)} className="self-start text-sm underline underline-offset-2">
            Put back the original wording
          </button>
        )
      )}
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </li>
  );
}
