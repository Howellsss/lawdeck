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
  const [notes, setNotes] = useState<{ error?: string; problems: string[]; info?: string; already?: string[] }>({ problems: [] });

  async function find() {
    setBusy(true);
    setNotes({ problems: [] });
    const result = await findDriveLinkFiles({ text }).catch(() => ({ ok: false as const, message: "The connection was lost. Try again." }));
    setBusy(false);
    if (!result.ok) return setNotes({ error: result.message, problems: [] });
    setNotes({
      problems: result.problems,
      info: result.files.length
        ? `Found ${result.files.length} new ${result.files.length === 1 ? "file" : "files"}${result.capped ? " (the first 100; import these, then paste again for the rest)" : ""}. Check the details below, then import.`
        : undefined,
      error: result.files.length
        ? undefined
        : result.already.length
          ? "Every file in those links is already in the library. Nothing new to import."
          : "No files to import were found in those links.",
      // Files already in the library are never imported again (founder, 2026-11-24).
      already: result.already.map((f) => `${f.name} (in the library as “${f.existingTitle}”)`),
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
        Works with any Google account: share the files or folder as <strong>Anyone with the link can view</strong>. A folder brings in every PDF, Word, PowerPoint, Google
        Doc, Google Slides, PNG and JPEG inside it (up to 100 MB each, 100 files at a time), and two levels of folders
        below it. Google Docs are saved as PDF and Google Slides as PowerPoint. Old PowerPoint (.ppt) files are listed
        but need saving as .pptx first.
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
      {notes.already && notes.already.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">
            {notes.already.length} {notes.already.length === 1 ? "file is" : "files are"} already in the library and will be skipped
          </summary>
          <ul aria-label="Already in the library" className="mt-1 flex list-disc flex-col gap-1 pl-5">
            {notes.already.slice(0, 200).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </details>
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
