import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_LIBRARY_FILE_TYPES, type AdminLibraryFileKind } from "@/lib/libraryFiles";
import type { Database } from "@/server/db/types";

// The archive of original library files (rule Q-03, migration 11): a separate private store that
// nobody can overwrite or delete from, so the library can be rebuilt from scratch. Never searched.
export const ARCHIVE_BUCKET = "library-archive";

const EXTENSIONS: Record<AdminLibraryFileKind, string> = { pdf: "pdf", docx: "docx", png: "png", jpeg: "jpg", pptx: "pptx" };

// Each file is stored under its content fingerprint (SHA-256), so a changed file is a new
// version beside the old one, and the same file is never stored twice.
export function archivePath(courseId: string, itemId: string, sha256: string, kind: AdminLibraryFileKind): string {
  return `${courseId}/${itemId}/${sha256}.${EXTENSIONS[kind]}`;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Copies an item's original into the archive and records where. Returns false if it failed; the
// caller stops so it can be tried again (an item is never left without its archived copy).
export async function archiveOriginal(
  db: SupabaseClient<Database>,
  item: { id: string; courseId: string },
  bytes: Uint8Array,
  kind: AdminLibraryFileKind,
): Promise<boolean> {
  const path = archivePath(item.courseId, item.id, sha256Hex(bytes), kind);
  const uploaded = await db.storage
    .from(ARCHIVE_BUCKET)
    .upload(path, bytes, { contentType: ADMIN_LIBRARY_FILE_TYPES[kind].mime, upsert: false });
  // Already archived (the same file read again) is fine: the copy is there.
  const alreadyThere = uploaded.error && /exists|duplicate/i.test(uploaded.error.message);
  if (uploaded.error && !alreadyThere) {
    console.error("archive failed", { itemId: item.id, step: "upload" });
    return false;
  }
  const recorded = await db.from("kb_items").update({ archive_path: path }).eq("id", item.id).is("archive_path", null);
  // Its fingerprint too, for items added before migration 71 (duplicate checks).
  await db.from("kb_items").update({ content_sha256: sha256Hex(bytes) }).eq("id", item.id).is("content_sha256", null);
  if (recorded.error) {
    console.error("archive failed", { itemId: item.id, step: "record", code: recorded.error.code });
    return false;
  }
  return true;
}
