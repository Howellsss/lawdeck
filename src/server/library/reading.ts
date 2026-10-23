import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/types";
import { archiveOriginal } from "./archive";
import {
  PAGE_TEXT_MAX_CHARS,
  ReadingError,
  readWithStore,
  type PageRow,
  type ReadStepResult,
  type ReadStore,
} from "./reader";

type Db = SupabaseClient<Database>;

const BUCKET = "library";

export type { ReadStepResult };
export { missingPages, nextBatch } from "./reader";

// Starting over ("Read again"): forget earlier page text and mark the item as being read.
export async function restartReading(db: Db, itemId: string): Promise<void> {
  const removed = await db.from("kb_item_pages").delete().eq("item_id", itemId);
  if (removed.error)
    throw new ReadingError(
      "Reading could not start. Please try again.",
      removed.error.code,
    );
  const updated = await db
    .from("kb_items")
    .update({
      reading_status: "reading",
      page_count: null,
      reading_error: null,
    })
    .eq("id", itemId);
  if (updated.error)
    throw new ReadingError(
      "Reading could not start. Please try again.",
      updated.error.code,
    );
}

// Does as much reading as fits in one request, then says how far it got. The screen calls it
// again until it is done, so a long scan is read over several requests and can be resumed.
// Does as much reading as fits in one request, then says how far it got (see ./reader.ts). The
// screen calls it again until it is done, so a long scan is read over several requests.
export async function readStep(
  db: Db,
  itemId: string,
  userId: string,
): Promise<ReadStepResult> {
  try {
    return await readWithStore(libraryStore(db, itemId), userId);
  } catch (error) {
    const reading = error instanceof ReadingError ? error : null;
    // Logs the step and error code only, never file contents (rule I-03).
    console.error("library reading failed", {
      code: reading?.code ?? (error as Error)?.name ?? "unknown",
    });
    const message =
      reading?.userMessage ?? "The file could not be read. Please try again.";
    await db
      .from("kb_items")
      .update({ reading_status: "failed", reading_error: message })
      .eq("id", itemId);
    return { ok: false, message };
  }
}

// Where a library item's pages and passages are kept.
function libraryStore(db: Db, itemId: string): ReadStore {
  let item: { course_id: string; archive_path: string | null } | null = null;
  return {
    async open() {
      const found = await db
        .from("kb_items")
        .select("storage_path, page_count, course_id, archive_path")
        .eq("id", itemId)
        .maybeSingle();
      if (found.error)
        throw new ReadingError(
          "The item could not be loaded. Please try again.",
          found.error.code,
        );
      if (!found.data) return null;
      if (!found.data.storage_path)
        throw new ReadingError("This item has no file to read.", "no_file");
      item = found.data;
      const download = await db.storage
        .from(BUCKET)
        .download(found.data.storage_path);
      if (download.error || !download.data)
        throw new ReadingError(
          "The file could not be opened. Please try again.",
          "download",
        );
      return {
        bytes: new Uint8Array(await download.data.arrayBuffer()),
        pageCount: found.data.page_count,
      };
    },
    // Rule Q-03: keep the original in the archive before reading it (once per item).
    async beforeRead(bytes, kind) {
      if (
        item &&
        !item.archive_path &&
        !(await archiveOriginal(
          db,
          { id: itemId, courseId: item.course_id },
          bytes,
          kind,
        ))
      ) {
        throw new ReadingError(
          "A safe copy of the file could not be stored. Please try again.",
          "archive",
        );
      }
    },
    async setPageCount(pageCount) {
      const updated = await db
        .from("kb_items")
        .update({ reading_status: "reading", page_count: pageCount })
        .eq("id", itemId);
      if (updated.error)
        throw new ReadingError(
          "Reading could not continue. Please try again.",
          updated.error.code,
        );
    },
    storedPages: () => storedPages(db, itemId),
    insertPages: (rows) => insertPages(db, itemId, rows),
    loadPages: () => loadPages(db, itemId),
    async savePassages(passages, method, quality, pages) {
      const { data, error } = await db.rpc("replace_kb_passages", {
        target_item: itemId,
        passages,
        method,
        quality,
        pages,
      });
      if (error)
        throw new ReadingError(
          "The passages could not be saved. Please try again.",
          error.code,
        );
      return data;
    },
  };
}

async function insertPages(db: Db, itemId: string, rows: PageRow[]) {
  if (rows.length === 0) return;
  const { error } = await db.from("kb_item_pages").upsert(
    rows.map((row) => ({
      item_id: itemId,
      page: row.page,
      text: row.text.slice(0, PAGE_TEXT_MAX_CHARS),
      method: row.method,
    })),
    { onConflict: "item_id,page", ignoreDuplicates: true },
  );
  if (error)
    throw new ReadingError(
      "Page text could not be saved. Please try again.",
      error.code,
    );
}

async function storedPages(db: Db, itemId: string): Promise<Set<number>> {
  const pages = new Set<number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("kb_item_pages")
      .select("page")
      .eq("item_id", itemId)
      .order("page")
      .range(from, from + 999);
    if (error)
      throw new ReadingError(
        "Reading could not continue. Please try again.",
        error.code,
      );
    for (const row of data) pages.add(row.page);
    if (data.length < 1000) return pages;
  }
}

async function loadPages(db: Db, itemId: string): Promise<PageRow[]> {
  const pages: PageRow[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await db
      .from("kb_item_pages")
      .select("page, text, method")
      .eq("item_id", itemId)
      .order("page")
      .range(from, from + 199);
    if (error)
      throw new ReadingError(
        "Reading could not finish. Please try again.",
        error.code,
      );
    pages.push(...(data as PageRow[]));
    if (data.length < 200) return pages;
  }
}
