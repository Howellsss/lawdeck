// ADMIN JOB: copies the original file of every library item that has none in the archive yet
// (rule Q-03, migration 11). Needed once for items read before migration 11; new items are
// archived when they are read. Uses the service key. Logs counts and item ids only.
import { expect, it } from "vitest";
import { detectFileKind } from "@/lib/libraryFiles";
import { createAdminClient } from "@/server/db/admin";
import { archiveOriginal } from "@/server/library/archive";

it("archives every library original that is not archived yet", async () => {
  const db = createAdminClient();
  if (!db) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY.");
  const items = await db.from("kb_items").select("id, course_id, storage_path").is("archive_path", null).not("storage_path", "is", null);
  if (items.error) throw new Error(`Items could not be loaded (${items.error.code})`);

  const failed: string[] = [];
  for (const item of items.data) {
    const download = await db.storage.from("library").download(item.storage_path as string);
    const bytes = download.data ? new Uint8Array(await download.data.arrayBuffer()) : null;
    const kind = bytes ? detectFileKind(bytes) : null;
    if (!bytes || !kind || !(await archiveOriginal(db, { id: item.id, courseId: item.course_id }, bytes, kind))) {
      failed.push(item.id);
    }
  }
  console.info(`Archive job: ${items.data.length - failed.length} archived, ${failed.length} failed${failed.length ? `: ${failed.join(", ")}` : ""}`);
  expect(failed).toEqual([]);
});
