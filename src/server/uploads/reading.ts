import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/types";
import {
  PAGE_TEXT_MAX_CHARS,
  ReadingError,
  readWithStore,
  type PageRow,
  type ReadStore,
} from "@/server/library/reader";
import { passageSearchText } from "@/server/retrieval/indexJob";
import { EMBEDDING_MODEL } from "@/server/retrieval/settings";
import {
  EMBED_BATCH,
  embedTexts,
  fitTokenBudget,
  toVectorText,
} from "@/server/retrieval/voyage";

// Reads a student's own upload (Phase 6, step 6b; PRD UP-01, UP-04) with the same reader as the
// library, then indexes it for search. Everything runs with the student's own session, never the
// master key: row-level security keeps the pages and passages theirs. Scanned pages count against
// the monthly allowance (Free: 200, founder 2026-10-23). Logs never contain file text.

type Db = SupabaseClient<Database>;
const BUCKET = "uploads";
const INDEX_BUDGET_MS = 60_000;

export const SCAN_ALLOWANCE_MESSAGE =
  "You have used this month’s scanned pages. The pages read so far are kept; use “Try again” next month to finish this file.";

export type UploadStepResult =
  | { ok: true; done: false; pagesRead: number; pageCount: number }
  | { ok: true; done: true; passages: number }
  | { ok: false; message: string };

// One step: reads as much as fits, and once the whole file is read, indexes it and marks it Ready.
// The screen calls it again until it is done. Pages already read are kept, so "Try again" carries
// on where reading stopped (scanned pages are never paid for twice).
export async function uploadStep(
  db: Db,
  uploadId: string,
  userId: string,
): Promise<UploadStepResult> {
  try {
    const read = await readWithStore(uploadStore(db, uploadId), userId);
    if (!read.ok) return read;
    if (!read.done)
      return {
        ok: true,
        done: false,
        pagesRead: read.pagesRead,
        pageCount: read.pageCount,
      };
    await indexPassages(db, uploadId);
    const finished = await db.rpc("finish_upload_reading", {
      target: uploadId,
    });
    if (finished.error)
      throw new ReadingError(
        "The file could not be finished. Please try again.",
        finished.error.code,
      );
    return { ok: true, done: true, passages: read.passages ?? 0 };
  } catch (error) {
    const reading = error instanceof ReadingError ? error : null;
    console.error("upload reading failed", {
      code: reading?.code ?? (error as Error)?.name ?? "unknown",
    });
    const message =
      reading?.userMessage ?? "The file could not be read. Please try again.";
    await db.rpc("fail_upload_reading", { target: uploadId, reason: message });
    return { ok: false, message };
  }
}

// Where a student's pages and passages are kept, and their scanned-page allowance.
export function uploadStore(db: Db, uploadId: string): ReadStore {
  return {
    async open() {
      const found = await db
        .from("uploads")
        .select("storage_path, page_count")
        .eq("id", uploadId)
        .maybeSingle();
      if (found.error)
        throw new ReadingError(
          "The file could not be loaded. Please try again.",
          found.error.code,
        );
      if (!found.data) return null;
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
    async setPageCount(pageCount) {
      const { error } = await db.rpc("set_upload_page_count", {
        target: uploadId,
        pages: pageCount,
      });
      if (error)
        throw new ReadingError(
          "Reading could not continue. Please try again.",
          error.code,
        );
    },
    async storedPages() {
      const pages = new Set<number>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from("upload_pages")
          .select("page")
          .eq("upload_id", uploadId)
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
    },
    async insertPages(rows) {
      if (rows.length === 0) return;
      const { error } = await db.from("upload_pages").upsert(
        rows.map((row) => ({
          upload_id: uploadId,
          page: row.page,
          text: row.text.slice(0, PAGE_TEXT_MAX_CHARS),
          method: row.method,
        })),
        { onConflict: "upload_id,page", ignoreDuplicates: true },
      );
      if (error)
        throw new ReadingError(
          "Page text could not be saved. Please try again.",
          error.code,
        );
    },
    async loadPages() {
      const pages: PageRow[] = [];
      for (let from = 0; ; from += 200) {
        const { data, error } = await db
          .from("upload_pages")
          .select("page, text, method")
          .eq("upload_id", uploadId)
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
    },
    async savePassages(passages, _method, quality, pages) {
      const { data, error } = await db.rpc("replace_upload_passages", {
        target: uploadId,
        passages,
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
    async scanPagesAllowed(wanted) {
      const { data, error } = await db.rpc("scan_pages_left");
      if (error)
        throw new ReadingError(
          "Reading could not continue. Please try again.",
          error.code,
        );
      return data === null ? wanted : Math.min(wanted, data);
    },
    async recordScanPages(pages) {
      const { error } = await db.rpc("record_scan_pages", { pages });
      if (error) console.error("scan pages not recorded", { code: error.code });
    },
    allowanceMessage: SCAN_ALLOWANCE_MESSAGE,
  };
}

// Gives the file's passages search vectors. Without a Voyage key the file is still searchable by
// its words, so it is finished anyway; other failures stop with a message to try again.
export async function indexPassages(db: Db, uploadId: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < INDEX_BUDGET_MS) {
    const { data: candidates, error } = await db
      .from("upload_passages")
      .select("id, heading, text")
      .eq("upload_id", uploadId)
      .or(`embedding_model.is.null,embedding_model.neq.${EMBEDDING_MODEL}`)
      .order("position")
      .limit(EMBED_BATCH);
    if (error)
      throw new ReadingError(
        "The file could not be prepared for search. Please try again.",
        error.code,
      );
    if (candidates.length === 0) return;
    const texts = candidates.map((p) => passageSearchText(p.heading, p.text));
    const batch = candidates.slice(0, Math.max(1, fitTokenBudget(texts)));
    const result = await embedTexts(
      texts.slice(0, batch.length),
      "document",
      EMBEDDING_MODEL,
      "upload_index",
    );
    if (!result.ok) {
      if (result.reason === "no_key") return;
      if (
        result.reason === "busy" &&
        Date.now() - started + (result.retryAfterMs ?? 0) < INDEX_BUDGET_MS
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, result.retryAfterMs ?? 0),
        );
        continue;
      }
      throw new ReadingError(
        "The file could not be prepared for search just now. Use “Try again” in a few minutes.",
        `index_${result.reason}`,
      );
    }
    const saved = await Promise.all(
      batch.map((passage, index) =>
        db
          .from("upload_passages")
          .update({
            embedding: toVectorText(result.vectors[index]),
            embedding_model: EMBEDDING_MODEL,
          })
          .eq("id", passage.id),
      ),
    );
    const failure = saved.find((row) => row.error);
    if (failure?.error)
      throw new ReadingError(
        "The file could not be prepared for search. Please try again.",
        failure.error.code,
      );
  }
  throw new ReadingError(
    "Preparing this file for search is taking long. Use “Try again” to carry on.",
    "index_time",
  );
}
