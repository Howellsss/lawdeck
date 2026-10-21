import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY_FILE_TYPES, type LibraryFileKind } from "@/lib/libraryFiles";
import type { Database } from "@/server/db/types";

// The archive of original library files (rule Q-03, migration 11): a separate private store that
// nobody can overwrite or delete from, so the library can be rebuilt from scratch. Never searched.
export const ARCHIVE_BUCKET = "library-archive";

const EXTENSIONS: Record<LibraryFileKind, string> = { pdf: "pdf", docx: "docx", png: "png", jpeg: "jpg" };

// Each file is stored under its content fingerprint (SHA-256), so a changed file is a new
// version beside the old one, and the same file is never stored twice.
export function archivePath(courseId: string, itemId: string, sha256: string, kind: LibraryFileKind): string {
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
  kind: LibraryFileKind,
): Promise<boolean> {
  const path = archivePath(item.courseId, item.id, sha256Hex(bytes), kind);
  const uploaded = await db.storage
    .from(ARCHIVE_BUCKET)
    .upload(path, bytes, { contentType: LIBRARY_FILE_TYPES[kind].mime, upsert: false });
  // Already archived (the same file read again) is fine: the copy is there.
  const alreadyThere = uploaded.error && /exists|duplicate/i.test(uploaded.error.message);
  if (uploaded.error && !alreadyThere) {
    console.error("archive failed", { itemId: item.id, step: "upload" });
    return false;
  }
  const recorded = await db.from("kb_items").update({ archive_path: path }).eq("id", item.id).is("archive_path", null);
  if (recorded.error) {
    console.error("archive failed", { itemId: item.id, step: "record", code: recorded.error.code });
    return false;
  }
  return true;
}
