"use server";

import { refresh } from "next/cache";
import type { FieldErrors } from "@/lib/fieldErrors";
import { detectFileKind, kindFromFileName, LIBRARY_FILE_TYPES } from "@/lib/libraryFiles";
import { driveImportSchema } from "@/schemas/library";
import { getStaffRole } from "@/server/auth/roles";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { parseDriveLinks } from "@/lib/driveLinks";
import { z } from "@/lib/zod";
import { driveServerKey, fetchDriveFile, resolveDriveLink, type DriveListed } from "./drive";
import { LIBRARY_BUCKET, recordLibraryItem } from "./items";

export type DriveImportResult =
  | { ok: true; id: string }
  | { ok: false; message: string; duplicate?: boolean; fieldErrors?: FieldErrors };

// Imports one file from Google Drive into the library: the same checks as an upload (admin
// role, details, real file type, 25 MB), then stored privately and recorded "awaiting review".
export async function importFromDrive(input: {
  accessToken?: string;
  fileId: string;
  details: { title: string; type: string; courseId: string; campus: string; year: string; source: string };
}): Promise<DriveImportResult> {
  const parsed = driveImportSchema.safeParse(input);
  if (!parsed.success) {
    const detailIssues = parsed.error.issues.filter((issue) => issue.path[0] === "details");
    if (detailIssues.length < parsed.error.issues.length) {
      return { ok: false, message: parsed.error.issues.find((i) => i.path[0] !== "details")?.message ?? "The import details were not valid." };
    }
    // Field errors keyed by the detail's own name (title, courseId, …).
    const fieldErrors: FieldErrors = {};
    for (const issue of detailIssues) fieldErrors[String(issue.path[1])] ??= issue.message;
    return { ok: false, message: "Check this file's details.", fieldErrors };
  }
  if ((await getStaffRole()) !== "admin") return { ok: false, message: "Only admins can add to the library." };

  const key = driveServerKey();
  const auth = parsed.data.accessToken ? { token: parsed.data.accessToken } : key ? { key } : null;
  if (!auth) return { ok: false, message: "Drive links are not switched on yet: the Google Drive server key is missing." };
  const file = await fetchDriveFile(auth, parsed.data.fileId);
  if (!file.ok) return file;
  if (file.name.length > 255) return { ok: false, message: "The file name is too long. Rename it in Google Drive and try again." };
  const named = kindFromFileName(file.name);
  const kind = detectFileKind(file.bytes);
  if (!kind || (named && named !== kind)) {
    return { ok: false, message: "That file is not a real PDF, Word (DOCX), PNG or JPEG file." };
  }

  const supabase = await createSupabaseServerClient();
  const details = parsed.data.details;
  // The same file (name and size) already in this course: skip it rather than add it twice.
  const existing = await supabase
    .from("kb_items")
    .select("id")
    .eq("course_id", details.courseId)
    .eq("file_name", file.name)
    .eq("size_bytes", file.bytes.length)
    .limit(1);
  if (existing.data?.length) {
    return { ok: false, duplicate: true, message: "This file is already in the library for this course, so it was skipped." };
  }

  const path = `${details.courseId}/${crypto.randomUUID()}.${kind}`;
  const stored = await supabase.storage
    .from(LIBRARY_BUCKET)
    .upload(path, file.bytes, { contentType: LIBRARY_FILE_TYPES[kind].mime, upsert: false });
  if (stored.error) {
    console.error("library action failed", { action: "importFromDrive.store", code: stored.error.name });
    return { ok: false, message: "The file could not be stored. Please try again." };
  }
  const added = await recordLibraryItem(supabase, details, { path, fileName: file.name, kind, size: file.bytes.length });
  if (!added.ok) {
    console.error("library action failed", { action: "importFromDrive.insert", code: added.code ?? "unknown" });
    return { ok: false, message: "The item was not saved. Please try again." };
  }
  refresh();
  return { ok: true, id: added.id };
}

// At most this many files from one paste (a big folder is cut off here).
const LINK_IMPORT_LIMIT = 100;

// Pasted Drive links (founder, 2026-11-08): the files they point to, ready to import. A folder
// link brings the importable files inside it (and its sub-folders). Admins only.
export async function findDriveLinkFiles(input: { text: string }): Promise<
  { ok: true; files: DriveListed[]; problems: string[]; capped: boolean } | { ok: false; message: string }
> {
  const parsed = z.object({ text: z.string().trim().min(1, { error: "Paste Google Drive links to files or folders, one per line." }).max(20_000, { error: "Paste up to about 100 links at a time." }) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Paste up to about 100 links at a time." };
  if ((await getStaffRole()) !== "admin") return { ok: false, message: "Only admins can add to the library." };
  const key = driveServerKey();
  if (!key) return { ok: false, message: "Drive links are not switched on yet: the Google Drive server key is missing." };
  const { links, notUnderstood } = parseDriveLinks(parsed.data.text);
  if (links.length === 0) return { ok: false, message: "Paste Google Drive links to files or folders, one per line." };
  const files: DriveListed[] = [];
  const seen = new Set<string>();
  const problems = notUnderstood.map((piece) => `Not a Google Drive link: ${piece}`);
  for (const link of links) {
    if (files.length >= LINK_IMPORT_LIMIT) break;
    const found = await resolveDriveLink(key, link, LINK_IMPORT_LIMIT - files.length);
    if (!found.ok) {
      problems.push(found.message);
      continue;
    }
    for (const f of found.files) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      files.push(f);
    }
  }
  return { ok: true, files, problems, capped: files.length >= LINK_IMPORT_LIMIT };
}
