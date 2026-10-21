import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectFileKind } from "@/lib/libraryFiles";
import { transcribePages, type ScanSource } from "@/server/ai/transcribe";
import type { Database } from "@/server/db/types";
import { pdfPageToBlocks, scanPageToBlocks, type Block } from "./blocks";
import { archiveOriginal } from "./archive";
import { needsScan, readDocxBlocks, readPdfText } from "./extract";
import { readingQuality, splitIntoPassages } from "./split";

type Db = SupabaseClient<Database>;
type PageMethod = "text" | "scan";

const BUCKET = "library";
// Scanned pages are read a few at a time, so each Claude call stays inside 60 seconds.
const SCAN_BATCH_PAGES = 3;
// Stop starting new batches after this long, so one step ends inside the page's time limit.
const STEP_BUDGET_MS = 150_000;
const PAGE_TEXT_MAX_CHARS = 100_000;

export type ReadStepResult =
  | { ok: true; done: boolean; pagesRead: number; pageCount: number; passages?: number }
  | { ok: false; message: string };

class ReadingError extends Error {
  constructor(public readonly userMessage: string, public readonly code: string) {
    super(code);
    this.name = "ReadingError";
  }
}

const SCAN_MESSAGES = {
  too_large:
    "Some pages are scanned, and the file is too large for them to be read (over about 22 MB). Split it into smaller files and upload them separately.",
  refused: "Claude declined to read some scanned pages. Check the file, then try again.",
  unavailable: "The scanned pages could not be read just now. Try again in a few minutes.",
  unreadable: "The scanned pages could not be read. Check the file is clear and not password-protected.",
} as const;

// Starting over ("Read again"): forget earlier page text and mark the item as being read.
export async function restartReading(db: Db, itemId: string): Promise<void> {
  const removed = await db.from("kb_item_pages").delete().eq("item_id", itemId);
  if (removed.error) throw new ReadingError("Reading could not start. Please try again.", removed.error.code);
  const updated = await db
    .from("kb_items")
    .update({ reading_status: "reading", page_count: null, reading_error: null })
    .eq("id", itemId);
  if (updated.error) throw new ReadingError("Reading could not start. Please try again.", updated.error.code);
}

// Does as much reading as fits in one request, then says how far it got. The screen calls it
// again until it is done, so a long scan is read over several requests and can be resumed.
export async function readStep(db: Db, itemId: string, userId: string): Promise<ReadStepResult> {
  const started = Date.now();
  try {
    const item = await db
      .from("kb_items")
      .select("storage_path, page_count, course_id, archive_path")
      .eq("id", itemId)
      .maybeSingle();
    if (item.error) throw new ReadingError("The item could not be loaded. Please try again.", item.error.code);
    if (!item.data) return { ok: false, message: "That item no longer exists." };
    if (!item.data.storage_path) throw new ReadingError("This item has no file to read.", "no_file");

    const download = await db.storage.from(BUCKET).download(item.data.storage_path);
    if (download.error || !download.data) throw new ReadingError("The file could not be opened. Please try again.", "download");
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    const kind = detectFileKind(bytes);
    if (!kind) throw new ReadingError("The file is not a PDF, Word, PNG or JPEG file.", "kind");
    // Rule Q-03: keep the original in the archive before reading it (once per item).
    if (!item.data.archive_path && !(await archiveOriginal(db, { id: itemId, courseId: item.data.course_id }, bytes, kind))) {
      throw new ReadingError("A safe copy of the file could not be stored. Please try again.", "archive");
    }

    if (kind === "docx") {
      const blocks = await readDocxBlocks(bytes);
      const quality = readingQuality([blocks.map((block) => block.text).join(" ")]);
      const passages = await savePassages(db, itemId, blocks, "text", quality, 0);
      return { ok: true, done: true, pagesRead: 0, pageCount: 0, passages };
    }

    let pageCount = item.data.page_count;
    if (pageCount === null) {
      pageCount = kind === "pdf" ? await storeTextLayer(db, itemId, bytes) : 1;
      const updated = await db
        .from("kb_items")
        .update({ reading_status: "reading", page_count: pageCount })
        .eq("id", itemId);
      if (updated.error) throw new ReadingError("Reading could not continue. Please try again.", updated.error.code);
    }
    if (pageCount === 0) throw new ReadingError("This PDF has no pages.", "no_pages");

    const source: ScanSource =
      kind === "pdf"
        ? { kind: "pdf", base64: Buffer.from(bytes).toString("base64") }
        : { kind: "image", base64: Buffer.from(bytes).toString("base64"), mediaType: kind === "png" ? "image/png" : "image/jpeg" };

    let stored = await storedPages(db, itemId);
    let missing = missingPages(pageCount, stored);
    while (missing.length > 0 && Date.now() - started < STEP_BUDGET_MS) {
      const batch = nextBatch(missing);
      const result = await transcribePages(source, batch[0], batch.at(-1) ?? batch[0], userId);
      if (!result.ok) throw new ReadingError(SCAN_MESSAGES[result.reason], `scan_${result.reason}`);
      // In a complete reply, a page with no marker had no text.
      const done = result.complete ? batch : batch.filter((page) => result.pages.has(page));
      await insertPages(
        db,
        itemId,
        done.map((page) => ({ page, text: result.pages.get(page) ?? "", method: "scan" as const })),
      );
      stored = await storedPages(db, itemId);
      missing = missingPages(pageCount, stored);
    }
    if (missing.length > 0) return { ok: true, done: false, pagesRead: stored.size, pageCount };

    const pages = await loadPages(db, itemId);
    const blocks = pages.flatMap((page) =>
      page.method === "scan" ? scanPageToBlocks(page.text, page.page) : pdfPageToBlocks(page.text, page.page),
    );
    const methods = new Set(pages.map((page) => page.method));
    const method = methods.size > 1 ? "mixed" : (pages[0]?.method ?? "text");
    const quality = readingQuality(pages.map((page) => page.text));
    const passages = await savePassages(db, itemId, blocks, method, quality, pageCount);
    return { ok: true, done: true, pagesRead: pageCount, pageCount, passages };
  } catch (error) {
    const reading = error instanceof ReadingError ? error : null;
    // Logs the step and error code only, never file contents (rule I-03).
    console.error("library reading failed", { code: reading?.code ?? (error as Error)?.name ?? "unknown" });
    const message = reading?.userMessage ?? "The file could not be read. Please try again.";
    await db.from("kb_items").update({ reading_status: "failed", reading_error: message }).eq("id", itemId);
    return { ok: false, message };
  }
}

// Stores the text of every PDF page that has a text layer; returns the number of pages.
async function storeTextLayer(db: Db, itemId: string, bytes: Uint8Array): Promise<number> {
  let pdf;
  try {
    pdf = await readPdfText(bytes);
  } catch {
    throw new ReadingError("The PDF could not be opened. It may be damaged or password-protected.", "pdf_open");
  }
  const rows = pdf.pages
    .map((text, index) => ({ page: index + 1, text, method: "text" as const }))
    .filter((row) => !needsScan(row.text));
  for (let i = 0; i < rows.length; i += 200) await insertPages(db, itemId, rows.slice(i, i + 200));
  return pdf.pageCount;
}

async function insertPages(db: Db, itemId: string, rows: { page: number; text: string; method: PageMethod }[]) {
  if (rows.length === 0) return;
  const { error } = await db.from("kb_item_pages").upsert(
    rows.map((row) => ({ item_id: itemId, page: row.page, text: row.text.slice(0, PAGE_TEXT_MAX_CHARS), method: row.method })),
    { onConflict: "item_id,page", ignoreDuplicates: true },
  );
  if (error) throw new ReadingError("Page text could not be saved. Please try again.", error.code);
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
    if (error) throw new ReadingError("Reading could not continue. Please try again.", error.code);
    for (const row of data) pages.add(row.page);
    if (data.length < 1000) return pages;
  }
}

async function loadPages(db: Db, itemId: string) {
  const pages: { page: number; text: string; method: PageMethod }[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await db
      .from("kb_item_pages")
      .select("page, text, method")
      .eq("item_id", itemId)
      .order("page")
      .range(from, from + 199);
    if (error) throw new ReadingError("Reading could not finish. Please try again.", error.code);
    pages.push(...data);
    if (data.length < 200) return pages;
  }
}

async function savePassages(
  db: Db,
  itemId: string,
  blocks: Block[],
  method: "text" | "scan" | "mixed",
  quality: number,
  pageCount: number,
): Promise<number> {
  const passages = splitIntoPassages(blocks);
  if (passages.length === 0) throw new ReadingError("No text was found in this file.", "no_text");
  const { data, error } = await db.rpc("replace_kb_passages", {
    target_item: itemId,
    passages,
    method,
    quality,
    pages: pageCount,
  });
  if (error) throw new ReadingError("The passages could not be saved. Please try again.", error.code);
  return data;
}

export function missingPages(pageCount: number, stored: Set<number>): number[] {
  const missing: number[] = [];
  for (let page = 1; page <= pageCount; page++) if (!stored.has(page)) missing.push(page);
  return missing;
}

// The next few missing pages that follow on from each other (one Claude call).
export function nextBatch(missing: number[]): number[] {
  const batch = missing.slice(0, 1);
  for (const page of missing.slice(1)) {
    if (batch.length >= SCAN_BATCH_PAGES || page !== (batch.at(-1) ?? 0) + 1) break;
    batch.push(page);
  }
  return batch;
}
