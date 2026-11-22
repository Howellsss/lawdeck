import "server-only";
import { z } from "@/lib/zod";
import { ADMIN_LIBRARY_MAX_BYTES, OLD_POWERPOINT_MESSAGE } from "@/lib/libraryFiles";

// Fetches one Drive file for the library, in one of two ways:
// - picked in Google's file picker: the picker's short-lived token ("drive.file" access: only the
//   files the admin picked). The token is used once and never stored or logged.
// - pasted as a link (founder, 2026-11-08): a server-only Google key that reads only files shared
//   as "Anyone with the link" (GOOGLE_DRIVE_SERVER_KEY, never sent to the browser).
// Google Docs are saved as PDF and Google Slides as PowerPoint (.pptx) on the way in. Library files
// may be up to 100 MB (founder, 2026-11-22).
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
// A stuck download never holds the request for more than this (100 MB on a slow link).
const TIMEOUT_MS = 180_000;
const TOO_BIG = "Library files must be 100 MB or smaller.";

const metadataSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string(),
  size: z.coerce.number().int().nonnegative().optional(),
});

export type DriveFile = { ok: true; name: string; bytes: Uint8Array } | { ok: false; message: string };
export type DriveAuth = { token: string } | { key: string };

const GOOGLE_DOC = "application/vnd.google-apps.document";
const GOOGLE_SLIDES = "application/vnd.google-apps.presentation";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const OLD_PPT = "application/vnd.ms-powerpoint";
const FOLDER = "application/vnd.google-apps.folder";

// The server-only key for pasted links; null until it is set in Vercel.
export function driveServerKey(): string | null {
  return process.env.GOOGLE_DRIVE_SERVER_KEY?.trim() || null;
}

function request(auth: DriveAuth, path: string, params: Record<string, string>): [string, RequestInit] {
  const query = new URLSearchParams({ ...params, supportsAllDrives: "true", ...("key" in auth ? { key: auth.key } : {}) });
  return [`${DRIVE_FILES}${path}?${query}`, "token" in auth ? { headers: { Authorization: `Bearer ${auth.token}` } } : {}];
}

function driveFetch(auth: DriveAuth, path: string, params: Record<string, string>, ms = 20_000): Promise<Response> {
  const [url, init] = request(auth, path, params);
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

const EXPIRED = "Google access has ended. Choose the files again with “Import from Google Drive”.";
const NOT_SHARED = "Lawdeck can't open this file. In Google Drive, share it (or its folder) as “Anyone with the link can view”.";

function explain(status: number, step: string, viaLink = false): DriveFile {
  console.error("drive import failed", { step, status });
  if (status === 401 || status === 403) return { ok: false, message: viaLink ? NOT_SHARED : EXPIRED };
  if (viaLink && status === 404) return { ok: false, message: NOT_SHARED };
  if (status === 404) return { ok: false, message: "That file is no longer in Google Drive, or Lawdeck was not given access to it." };
  return { ok: false, message: "Google Drive did not respond. Try again in a minute." };
}

export async function fetchDriveFile(auth: DriveAuth, fileId: string): Promise<DriveFile> {
  const viaLink = "key" in auth;
  try {
    const meta = await driveFetch(auth, `/${encodeURIComponent(fileId)}`, { fields: "name,mimeType,size" });
    if (!meta.ok) return explain(meta.status, "metadata", viaLink);
    const parsed = metadataSchema.safeParse(await meta.json());
    if (!parsed.success) return explain(502, "metadata", viaLink);
    const doc = parsed.data.mimeType === GOOGLE_DOC;
    const slides = parsed.data.mimeType === GOOGLE_SLIDES;
    if (parsed.data.mimeType === OLD_PPT) return { ok: false, message: OLD_POWERPOINT_MESSAGE };
    if (!doc && !slides && parsed.data.mimeType.startsWith("application/vnd.google-apps.")) {
      return { ok: false, message: "Google Sheets and folders can't be imported as files. Use Google Docs, Google Slides, PDF, Word (DOCX), PowerPoint (PPTX), PNG or JPEG." };
    }
    if ((parsed.data.size ?? 0) > ADMIN_LIBRARY_MAX_BYTES) return { ok: false, message: TOO_BIG };

    // A Google Doc is saved as PDF, Google Slides as PowerPoint; anything else is downloaded as it is.
    const exportAs = doc ? "application/pdf" : slides ? PPTX : null;
    const [url, init] = exportAs
      ? request(auth, `/${encodeURIComponent(fileId)}/export`, { mimeType: exportAs })
      : request(auth, `/${encodeURIComponent(fileId)}`, { alt: "media" });
    const media = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!media.ok || !media.body) return explain(media.status, "download", viaLink);
    const bytes = await readCapped(media.body, ADMIN_LIBRARY_MAX_BYTES);
    if (!bytes) return { ok: false, message: TOO_BIG };
    const name =
      doc && !/\.pdf$/i.test(parsed.data.name)
        ? `${parsed.data.name}.pdf`
        : slides && !/\.pptx$/i.test(parsed.data.name)
          ? `${parsed.data.name}.pptx`
          : parsed.data.name;
    return { ok: true, name, bytes };
  } catch (error) {
    console.error("drive import failed", { step: "fetch", name: (error as Error)?.name });
    return { ok: false, message: "Google Drive could not be reached. Try again in a minute." };
  }
}

export type DriveListed = { id: string; name: string; sizeBytes: number };
const listSchema = z.object({
  files: z.array(z.object({ id: z.string(), name: z.string(), mimeType: z.string(), size: z.coerce.number().int().nonnegative().optional() })).default([]),
  nextPageToken: z.string().optional(),
});
const ACCEPTED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  GOOGLE_DOC,
  GOOGLE_SLIDES,
  PPTX,
  // Listed so the admin sees why it was not imported (OLD_POWERPOINT_MESSAGE).
  OLD_PPT,
]);

// What a pasted link points to: one file, or the importable files in a shared folder (its
// sub-folders too, two levels down), at most `limit` in all.
export async function resolveDriveLink(
  key: string,
  link: { id: string; folder: boolean },
  limit: number,
): Promise<{ ok: true; files: DriveListed[] } | { ok: false; message: string }> {
  const auth = { key };
  try {
    if (!link.folder) {
      const meta = await driveFetch(auth, `/${encodeURIComponent(link.id)}`, { fields: "name,mimeType,size" });
      if (!meta.ok) return explain(meta.status, "link", true) as { ok: false; message: string };
      const parsed = metadataSchema.safeParse(await meta.json());
      if (!parsed.success) return { ok: false, message: "Google Drive did not respond. Try again in a minute." };
      if (parsed.data.mimeType === FOLDER) return resolveDriveLink(key, { id: link.id, folder: true }, limit);
      if (!ACCEPTED.has(parsed.data.mimeType)) return { ok: false, message: `“${parsed.data.name}” is not a Google Doc, Google Slides, PDF, Word, PowerPoint, PNG or JPEG file.` };
      return { ok: true, files: [{ id: link.id, name: parsed.data.name, sizeBytes: parsed.data.size ?? 0 }] };
    }
    const files: DriveListed[] = [];
    const folders = [{ id: link.id, depth: 0 }];
    while (folders.length && files.length < limit) {
      const folder = folders.shift()!;
      let pageToken: string | undefined;
      do {
        const params: Record<string, string> = {
          q: `'${folder.id}' in parents and trashed = false`,
          fields: "nextPageToken,files(id,name,mimeType,size)",
          pageSize: "200",
          includeItemsFromAllDrives: "true",
          orderBy: "name",
        };
        if (pageToken) params.pageToken = pageToken;
        const res = await driveFetch(auth, "", params);
        if (!res.ok) return explain(res.status, "folder", true) as { ok: false; message: string };
        const page = listSchema.safeParse(await res.json());
        if (!page.success) return { ok: false, message: "Google Drive did not respond. Try again in a minute." };
        for (const f of page.data.files) {
          if (f.mimeType === FOLDER) {
            if (folder.depth < 2) folders.push({ id: f.id, depth: folder.depth + 1 });
          } else if (ACCEPTED.has(f.mimeType) && files.length < limit) {
            files.push({ id: f.id, name: f.name, sizeBytes: f.size ?? 0 });
          }
        }
        pageToken = page.data.nextPageToken;
      } while (pageToken && files.length < limit);
    }
    return { ok: true, files };
  } catch (error) {
    console.error("drive link failed", { name: (error as Error)?.name });
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
