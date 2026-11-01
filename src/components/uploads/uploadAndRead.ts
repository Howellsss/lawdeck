import { uploadFile } from "@/components/library/uploadFile";
import { kindFromFileName, LIBRARY_MAX_BYTES } from "@/lib/libraryFiles";
import { finishUpload, startUpload } from "@/server/uploads/actions";
import { readUploadUntilDone } from "./readUpload";

// One student file, start to finish: check it, upload it into their private folder, then read
// it so answers can use it (PRD UP-01). Used by My uploads and by the question boxes' attach
// button. Progress is reported as plain text for the screen.
export type UploadOutcome =
  | { ok: true; id: string }
  | { ok: false; message: string; needsNotice?: boolean; uploadedId?: string };

export async function uploadAndRead(
  file: File,
  apiKey: string,
  onProgress: (text: string) => void,
): Promise<UploadOutcome> {
  if (file.size === 0) return { ok: false, message: "Choose a file to upload." };
  if (file.size > LIBRARY_MAX_BYTES) return { ok: false, message: "Files must be 25 MB or smaller." };
  const kind = kindFromFileName(file.name);
  if (!kind) return { ok: false, message: "Upload a PDF, Word (DOCX), PNG or JPEG file." };

  const details = { fileName: file.name, size: file.size, kind };
  onProgress("Uploading… 0%");
  const started = await startUpload(details);
  if (!started.ok) return { ok: false, message: started.message, needsNotice: started.needsNotice };
  try {
    await uploadFile(started.signedUrl, file, apiKey, (percent) => onProgress(`Uploading… ${percent}%`));
  } catch {
    return { ok: false, message: "The upload stopped. Check your connection and try again." };
  }
  const finished = await finishUpload({ ...details, path: started.path });
  if (!finished.ok) return { ok: false, message: finished.message };

  // Read it straight away, so it can be searched.
  onProgress("Reading…");
  const read = await readUploadUntilDone(finished.id, onProgress);
  if (!read.ok)
    return {
      ok: false,
      uploadedId: finished.id,
      message: `“${file.name}” is uploaded, but reading stopped: ${read.message} You can carry on from My uploads.`,
    };
  return { ok: true, id: finished.id };
}
