import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY_FILE_TYPES, type LibraryFileKind } from "@/lib/libraryFiles";
import type { Database } from "@/server/db/types";

export const LIBRARY_BUCKET = "library";

export type ItemDetails = {
  title: string;
  type: Database["public"]["Enums"]["kb_item_type"];
  courseId: string;
  campus: string | null;
  year: number | null;
  source: string | null;
};

// Records a checked file as a library item "awaiting review". If that fails, the stored file
// is removed so nothing is left behind. Used by both the upload form and the Drive import.
export async function recordLibraryItem(
  db: SupabaseClient<Database>,
  details: ItemDetails,
  file: { path: string; fileName: string; kind: LibraryFileKind; size: number },
): Promise<{ ok: true; id: string } | { ok: false; code: string | undefined }> {
  const { data, error } = await db
    .from("kb_items")
    .insert({
      title: details.title,
      type: details.type,
      course_id: details.courseId,
      campus: details.campus,
      year: details.year,
      source: details.source,
      storage_path: file.path,
      file_name: file.fileName,
      mime_type: LIBRARY_FILE_TYPES[file.kind].mime,
      size_bytes: file.size,
    })
    .select("id")
    .single();
  if (error) {
    await db.storage.from(LIBRARY_BUCKET).remove([file.path]);
    return { ok: false, code: error.code };
  }
  return { ok: true, id: data.id };
}
