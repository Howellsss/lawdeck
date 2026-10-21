"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { guessCourse, guessYear, titleFromFileName } from "@/lib/driveGuess";
import { importFromDrive } from "@/server/library/driveActions";
import { DriveFileRow, type DriveRow } from "./DriveFileRow";
import { pickDriveFiles, type PickerConfig } from "./googlePicker";
import { readAndIndex } from "./readItem";

type Courses = { id: string; name: string }[];

// Admins pick several files in Google Drive, check the suggested details, and import them.
// Each file is fetched by the server, checked like an upload, then read and indexed.
export function DriveImport({ config, courses }: { config: PickerConfig; courses: Courses }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<DriveRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "warning" | "success"; message: string } | null>(null);

  const update = (index: number, change: Partial<DriveRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  async function choose() {
    setNotice(null);
    try {
      const picked = await pickDriveFiles(config);
      if (picked.files.length === 0) return;
      setToken(picked.token);
      setRows(
        picked.files.map((file) => ({
          fileId: file.id,
          fileName: file.name,
          sizeBytes: file.sizeBytes,
          title: titleFromFileName(file.name),
          courseId: guessCourse(file.name, courses) ?? "",
          year: guessYear(file.name),
          status: "ready",
        })),
      );
    } catch {
      setNotice({ tone: "warning", message: "Google Drive did not open. Allow pop-ups for this site, then try again." });
    }
  }

  async function importAll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");
    setBusy(true);
    setNotice(null);
    let done = 0;
    for (const [index, row] of rows.entries()) {
      if (row.status === "done" || row.status === "skipped") continue;
      update(index, { status: "importing", message: "Fetching from Google Drive…", errors: undefined });
      const result = await importFromDrive({
        accessToken: token,
        fileId: row.fileId,
        details: {
          title: text(`title-${index}`),
          type: text(`type-${index}`),
          courseId: text(`courseId-${index}`),
          year: text(`year-${index}`),
          campus: text("campus"),
          source: text("source"),
        },
      }).catch(() => ({ ok: false as const, message: "The connection was lost. Try again.", duplicate: false }));
      if (!result.ok) {
        update(index, {
          status: result.duplicate ? "skipped" : "failed",
          message: result.message,
          errors: "fieldErrors" in result ? result.fieldErrors : undefined,
        });
        continue;
      }
      update(index, { status: "reading", message: "Reading…" });
      const read = await readAndIndex(result.id, true, (progress) => update(index, { message: progress }));
      update(index, {
        status: "done",
        message: read.ok
          ? `Added, read into ${read.passages} passages and indexed. Awaiting review.`
          : `Added, but ${read.stage === "index" ? "indexing" : "reading"} stopped: ${read.message} Try again from the list below.`,
      });
      done++;
    }
    setBusy(false);
    router.refresh();
    if (done > 0) setNotice({ tone: "success", message: `${done} ${done === 1 ? "file was" : "files were"} added from Google Drive.` });
  }

  const remaining = rows.filter((row) => row.status !== "done" && row.status !== "skipped").length;
  return (
    <section aria-labelledby="drive-import" className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
      <h2 id="drive-import" className="text-lg font-medium">
        Import from Google Drive
      </h2>
      <p className="text-sm text-muted">
        Choose several files at once (PDF, Word, PNG or JPEG, up to 25 MB each). Lawdeck can open only the files you
        choose, and only for about an hour.
      </p>
      <FormAlert message={notice?.message} tone={notice?.tone} />
      <div>
        <button type="button" onClick={choose} disabled={busy} className={compactSecondaryButton}>
          {rows.length ? "Choose different files" : "Choose files in Google Drive"}
        </button>
      </div>
      {rows.length > 0 && (
        <form onSubmit={importAll} noValidate className="flex flex-col gap-4">
          <ul aria-label="Files to import" className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {rows.map((row, index) => (
              <DriveFileRow key={row.fileId} row={row} index={index} courses={courses} disabled={busy} />
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Campus (optional, for all)" name="campus" maxLength={80} disabled={busy} />
            <TextField label="Source (optional, for all)" name="source" maxLength={500} disabled={busy} />
          </div>
          {busy && (
            <p role="status" className="text-sm text-muted">
              Importing… Keep this page open.
            </p>
          )}
          <div>
            <button type="submit" disabled={busy || remaining === 0} className={compactPrimaryButton}>
              {busy ? "Importing…" : `Import ${remaining} ${remaining === 1 ? "file" : "files"}`}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
