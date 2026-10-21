"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { FieldErrors } from "@/lib/fieldErrors";
import { kindFromFileName, LIBRARY_ACCEPT, LIBRARY_MAX_BYTES } from "@/lib/libraryFiles";
import { KB_ITEM_TYPES } from "@/lib/libraryLabels";
import { finishLibraryUpload, startLibraryUpload, type UploadDetails } from "@/server/library/actions";
import { progressText, readUntilDone } from "./readItem";
import { SelectField } from "./SelectField";
import { uploadFile } from "./uploadFile";

type Status = { tone: "warning" | "success"; message: string } | null;

// Admin form: one library file plus its details. The file goes straight to private storage.
export function UploadForm({ courses, apiKey }: { courses: { id: string; name: string }[]; apiKey: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [reading, setReading] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return setErrors({ file: "Choose a file to upload." });
    if (file.size > LIBRARY_MAX_BYTES) return setErrors({ file: "Files must be 25 MB or smaller." });
    const kind = kindFromFileName(file.name);
    if (!kind) return setErrors({ file: "Upload a PDF, Word (DOCX), PNG or JPEG file." });

    const text = (key: string) => String(form.get(key) ?? "");
    const details: UploadDetails = {
      title: text("title"),
      type: text("type"),
      courseId: text("courseId"),
      campus: text("campus"),
      year: text("year"),
      source: text("source"),
      fileName: file.name,
      size: file.size,
      kind,
    };

    setProgress(0);
    const started = await startLibraryUpload(details);
    if (!started.ok) {
      setProgress(null);
      setErrors(started.fieldErrors ?? {});
      if (started.message) setStatus({ tone: "warning", message: started.message });
      return;
    }
    setErrors({});
    try {
      await uploadFile(started.signedUrl, file, apiKey, setProgress);
    } catch {
      setProgress(null);
      return setStatus({ tone: "warning", message: "The upload stopped. Check your connection and try again." });
    }
    const finished = await finishLibraryUpload({ ...details, path: started.path });
    setProgress(null);
    if (!finished.ok) return setStatus({ tone: "warning", message: finished.message });
    formRef.current?.reset();

    // Read the file into passages straight away.
    const title = details.title.trim();
    setReading("Reading…");
    const read = await readUntilDone(finished.id, true, (step) => setReading(progressText(step)));
    setReading(null);
    router.refresh();
    if (!read.ok) {
      return setStatus({
        tone: "warning",
        message: `“${title}” was added, but reading it stopped: ${read.message} You can try again from the list below.`,
      });
    }
    setStatus({
      tone: "success",
      message: `“${title}” was added and read into ${read.passages ?? 0} passages. It is awaiting review.`,
    });
  }

  const busy = progress !== null || reading !== null;
  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-lg font-medium">Add to the library</h2>
      <FormAlert message={status?.message} tone={status?.tone} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="library-file" className="px-1 text-sm font-medium">
          File
        </label>
        <input
          id="library-file"
          name="file"
          type="file"
          accept={LIBRARY_ACCEPT}
          required
          aria-describedby="library-file-hint"
          aria-invalid={errors.file ? true : undefined}
          className="rounded-2xl border border-line bg-sidebar px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-pill file:px-4 file:py-2 file:text-ink"
        />
        <p id="library-file-hint" className={`px-1 text-sm ${errors.file ? "text-warning" : "text-muted"}`}>
          {errors.file ?? "PDF, Word (DOCX), PNG or JPEG, up to 25 MB."}
        </p>
      </div>
      <TextField label="Title" name="title" required maxLength={300} error={errors.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" name="type" error={errors.type} options={Object.entries(KB_ITEM_TYPES)} />
        <SelectField
          label="Course"
          name="courseId"
          error={errors.courseId}
          options={courses.map((course): [string, string] => [course.id, course.name])}
        />
        <TextField label="Year (optional)" name="year" inputMode="numeric" maxLength={4} error={errors.year} />
        <TextField label="Campus (optional)" name="campus" maxLength={80} error={errors.campus} />
      </div>
      <TextField
        label="Source (optional)"
        name="source"
        maxLength={500}
        hint="Where it came from, e.g. a lecturer's handout or a law report."
        error={errors.source}
      />
      {reading !== null && (
        <p role="status" className="text-sm text-muted">
          {reading}. Keep this page open.
        </p>
      )}
      {progress !== null && (
        <div role="status" className="flex items-center gap-3 text-sm text-muted">
          <progress value={progress} max={100} className="h-2 flex-1 accent-ink" aria-label="Upload progress" />
          {progress}%
        </div>
      )}
      <div>
        <button type="submit" disabled={busy} className={compactPrimaryButton}>
          {progress !== null ? "Uploading…" : reading !== null ? "Reading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
