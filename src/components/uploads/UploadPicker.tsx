"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/components/library/uploadFile";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { kindFromFileName, LIBRARY_ACCEPT, LIBRARY_MAX_BYTES } from "@/lib/libraryFiles";
import { finishUpload, startUpload } from "@/server/uploads/actions";

type Status = { tone: "warning" | "success"; message: string } | null;

// Choose a file and upload it straight into the student's own private folder.
export function UploadPicker({ apiKey, full }: { apiKey: string; full: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) return setStatus({ tone: "warning", message: "Choose a file to upload." });
    if (file.size > LIBRARY_MAX_BYTES) return setStatus({ tone: "warning", message: "Files must be 25 MB or smaller." });
    const kind = kindFromFileName(file.name);
    if (!kind) return setStatus({ tone: "warning", message: "Upload a PDF, Word (DOCX), PNG or JPEG file." });

    const details = { fileName: file.name, size: file.size, kind };
    setProgress(0);
    const started = await startUpload(details);
    if (!started.ok) {
      setProgress(null);
      return setStatus({ tone: "warning", message: started.message });
    }
    try {
      await uploadFile(started.signedUrl, file, apiKey, setProgress);
    } catch {
      setProgress(null);
      return setStatus({ tone: "warning", message: "The upload stopped. Check your connection and try again." });
    }
    const finished = await finishUpload({ ...details, path: started.path });
    setProgress(null);
    if (!finished.ok) return setStatus({ tone: "warning", message: finished.message });
    formRef.current?.reset();
    setStatus({ tone: "success", message: `“${file.name}” is uploaded. Lawdeck will read it so you can ask about it.` });
  }

  if (full)
    return <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">You have reached your plan’s limit of files. Delete a file to add another.</p>;

  return (
    <form ref={formRef} onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <label htmlFor="upload-file" className="font-medium">
        Add a file
      </label>
      <p id="upload-help" className="text-sm text-muted">
        PDF, Word (DOCX), PNG or JPEG, up to 25 MB.
      </p>
      <input
        id="upload-file"
        name="file"
        type="file"
        accept={LIBRARY_ACCEPT}
        aria-describedby="upload-help"
        disabled={progress !== null}
        className="min-h-11 w-full text-sm file:mr-3 file:h-11 file:rounded-full file:border file:border-line file:bg-paper file:px-4 file:text-ink"
      />
      <button type="submit" disabled={progress !== null} className={`${compactPrimaryButton} self-start`}>
        {progress === null ? "Upload" : `Uploading… ${Math.round(progress)}%`}
      </button>
      {status && (
        <p role={status.tone === "warning" ? "alert" : "status"} className={`text-sm ${status.tone === "warning" ? "text-warning" : "text-success"}`}>
          {status.message}
        </p>
      )}
    </form>
  );
}
