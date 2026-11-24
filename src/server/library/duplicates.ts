import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/types";

// No duplicate files in the library (founder, 2026-11-24; migration 71). A file counts as already
// added when an item in the library (any course, any review state) came from the same Google
// Drive file, has the same contents (fingerprint), or has the same file name and size.

type Db = SupabaseClient<Database>;

export type AlreadyAdded = { id: string; name: string; existingTitle: string };

// Before downloading: which of these Drive files are already in the library.
export async function alreadyInLibrary(
  db: Db,
  files: { id: string; name: string; sizeBytes: number }[],
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (files.length === 0) return found;
  // In batches, so a big folder never makes one request too long.
  const chunks = <T,>(list: T[]) => Array.from({ length: Math.ceil(list.length / 50) }, (_, i) => list.slice(i * 50, i * 50 + 50));
  const ids = files.map((f) => f.id);
  const names = [...new Set(files.map((f) => f.name))];
  const results = await Promise.all([
    ...chunks(ids).map((part) => db.from("kb_items").select("title, drive_file_id, file_name, size_bytes").in("drive_file_id", part)),
    ...chunks(names).map((part) => db.from("kb_items").select("title, drive_file_id, file_name, size_bytes").in("file_name", part)),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("duplicate check failed", { code: failed.error.code });
    return found;
  }
  const rows = results.flatMap((r) => r.data ?? []);
  for (const row of rows) if (row.drive_file_id) found.set(row.drive_file_id, row.title);
  const nameSize = new Map(rows.map((row) => [`${row.file_name}|${row.size_bytes}`, row.title]));
  for (const f of files) {
    const title = nameSize.get(`${f.name}|${f.sizeBytes}`);
    if (title && !found.has(f.id)) found.set(f.id, title);
  }
  return found;
}

// After downloading: an item with the same contents, or the same name and size (any course).
export async function sameFileInLibrary(
  db: Db,
  file: { sha256: string; name: string; size: number; driveFileId?: string },
): Promise<string | null> {
  const checks = [
    db.from("kb_items").select("title").eq("content_sha256", file.sha256).limit(1),
    db.from("kb_items").select("title").eq("file_name", file.name).eq("size_bytes", file.size).limit(1),
    file.driveFileId ? db.from("kb_items").select("title").eq("drive_file_id", file.driveFileId).limit(1) : null,
  ];
  for (const result of await Promise.all(checks)) {
    if (result && !result.error && result.data?.[0]) return result.data[0].title;
  }
  return null;
}

export function duplicateMessage(existingTitle: string): string {
  return `Already in the library as “${existingTitle}”, so it was skipped.`;
}
