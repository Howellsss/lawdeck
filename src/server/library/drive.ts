import "server-only";
import { z } from "@/lib/zod";
import { LIBRARY_MAX_BYTES } from "@/lib/libraryFiles";

// Fetches one file the admin picked in Google's file picker, using the short-lived access
// token from that picker. Lawdeck only has "drive.file" access: the files the admin picked,
// nothing else. The token is used once and never stored or logged.
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
// A stuck download never holds the request for more than this (25 MB on a slow link).
const TIMEOUT_MS = 90_000;

const metadataSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string(),
  size: z.coerce.number().int().nonnegative().optional(),
});

export type DriveFile = { ok: true; name: string; bytes: Uint8Array } | { ok: false; message: string };

const EXPIRED = "Google access has ended. Choose the files again with “Import from Google Drive”.";

function explain(status: number, step: string): DriveFile {
  console.error("drive import failed", { step, status });
  if (status === 401 || status === 403) return { ok: false, message: EXPIRED };
  if (status === 404) return { ok: false, message: "That file is no longer in Google Drive, or Lawdeck was not given access to it." };
  return { ok: false, message: "Google Drive did not respond. Try again in a minute." };
}

export async function fetchDriveFile(accessToken: string, fileId: string): Promise<DriveFile> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  try {
    const meta = await fetch(`${DRIVE_FILES}/${encodeURIComponent(fileId)}?fields=name,mimeType,size&supportsAllDrives=true`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    if (!meta.ok) return explain(meta.status, "metadata");
    const parsed = metadataSchema.safeParse(await meta.json());
    if (!parsed.success) return explain(502, "metadata");
    if (parsed.data.mimeType.startsWith("application/vnd.google-apps.")) {
      return { ok: false, message: "Google Docs, Sheets and Slides can't be imported. Use PDF, Word (DOCX), PNG or JPEG files." };
    }
    if ((parsed.data.size ?? 0) > LIBRARY_MAX_BYTES) return { ok: false, message: "Files must be 25 MB or smaller." };

    const media = await fetch(`${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!media.ok || !media.body) return explain(media.status, "download");
    const bytes = await readCapped(media.body, LIBRARY_MAX_BYTES);
    if (!bytes) return { ok: false, message: "Files must be 25 MB or smaller." };
    return { ok: true, name: parsed.data.name, bytes };
  } catch (error) {
    console.error("drive import failed", { step: "fetch", name: (error as Error)?.name });
    return { ok: false, message: "Google Drive could not be reached. Try again in a minute." };
  }
}

// Reads a download but stops (and returns null) as soon as it passes the limit.
async function readCapped(body: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
