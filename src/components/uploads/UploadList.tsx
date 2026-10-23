import { formatWat } from "@/lib/dates";
import { UPLOAD_STATUS_LABELS } from "@/schemas/uploads";
import type { UploadRow } from "@/server/db/uploads";
import { DeleteUploadButton } from "./DeleteUploadButton";

// Below this, a file's extraction quality is flagged to the student (PRD UP-04).
const LOW_QUALITY = 0.8;

export function UploadList({ files }: { files: UploadRow[] }) {
  if (files.length === 0)
    return <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">No files yet. Your uploads will be listed here.</p>;
  return (
    <ul aria-label="Your uploads" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
      {files.map((file) => (
        <li key={file.id} className="flex flex-col gap-2 px-4 py-3">
          <p className="break-words font-medium">{file.fileName}</p>
          <p className="text-sm text-muted">
            {sizeLabel(file.sizeBytes)} · uploaded {formatWat(file.createdAt)} ·{" "}
            <span className={file.status === "ready" ? "text-success" : file.status === "failed" ? "text-warning" : ""}>
              {UPLOAD_STATUS_LABELS[file.status]}
            </span>
          </p>
          {file.ocrConfidence !== null && file.ocrConfidence < LOW_QUALITY && (
            <p className="text-sm text-warning">Parts of this file were hard to read, so answers from it may miss words. A clearer copy will work better.</p>
          )}
          <DeleteUploadButton id={file.id} fileName={file.fileName} />
        </li>
      ))}
    </ul>
  );
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
