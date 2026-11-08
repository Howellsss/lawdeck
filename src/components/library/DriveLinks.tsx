"use client";

import { useState } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import type { DriveListed } from "@/server/library/drive";
import { findDriveLinkFiles } from "@/server/library/driveActions";

// Paste Google Drive links (founder, 2026-11-08): files or whole shared folders, one per line, from
// any Google account, as long as they are shared as "Anyone with the link can view".
export function DriveLinks({ disabled, onFound }: { disabled: boolean; onFound: (files: DriveListed[]) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<{ error?: string; problems: string[]; info?: string }>({ problems: [] });

  async function find() {
    setBusy(true);
    setNotes({ problems: [] });
    const result = await findDriveLinkFiles({ text }).catch(() => ({ ok: false as const, message: "The connection was lost. Try again." }));
    setBusy(false);
    if (!result.ok) return setNotes({ error: result.message, problems: [] });
    setNotes({
      problems: result.problems,
      info: result.files.length
        ? `Found ${result.files.length} ${result.files.length === 1 ? "file" : "files"}${result.capped ? " (the first 100; import these, then paste again for the rest)" : ""}. Check the details below, then import.`
        : undefined,
      error: result.files.length ? undefined : "No files to import were found in those links.",
    });
    if (result.files.length) onFound(result.files);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Or paste Google Drive links (files or folders, one per line)
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={20000}
          disabled={disabled || busy}
          placeholder="https://drive.google.com/drive/folders/…"
          className="rounded-lg border border-line bg-paper px-3 py-2 text-[15px] font-normal"
        />
      </label>
      <p className="text-sm text-muted">
        Works with any Google account: share the files or folder as <strong>Anyone with the link can view</strong>. A folder brings in every PDF, Word, Google
        Doc, PNG and JPEG inside it, up to 100 at a time. Google Docs are saved as PDF.
      </p>
      <div>
        <button type="button" onClick={() => void find()} disabled={disabled || busy || !text.trim()} className={compactSecondaryButton}>
          {busy ? "Finding files…" : "Find files from links"}
        </button>
      </div>
      {notes.error && (
        <p role="alert" className="text-sm text-warning">
          {notes.error}
        </p>
      )}
      {notes.info && (
        <p role="status" className="text-sm text-muted">
          {notes.info}
        </p>
      )}
      {notes.problems.length > 0 && (
        <ul aria-label="Links that could not be used" className="flex list-disc flex-col gap-1 pl-5 text-sm text-warning">
          {notes.problems.slice(0, 20).map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
