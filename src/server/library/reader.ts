import "server-only";
import { detectFileKind, type LibraryFileKind } from "@/lib/libraryFiles";
import { transcribePages, type ScanSource } from "@/server/ai/transcribe";
import { pdfPageToBlocks, scanPageToBlocks, type Block } from "./blocks";
import { needsScan, readDocxBlocks, readPdfText } from "./extract";
import { readingQuality, splitIntoPassages, type Passage } from "./split";

// The one file reader, shared by library items (admins) and students' private uploads (step 6b):
// text from Word files and PDF text layers, scanned pages and photos read by Claude a few pages at
// a time, then split into passages. Where the pages and passages are kept is up to the store.

export type PageMethod = "text" | "scan";
export type PageRow = { page: number; text: string; method: PageMethod };

// Scanned pages are read a few at a time, so each Claude call stays inside 60 seconds.
const SCAN_BATCH_PAGES = 3;
// Stop starting new batches after this long, so one step ends inside the page's time limit.
const STEP_BUDGET_MS = 150_000;
export const PAGE_TEXT_MAX_CHARS = 100_000;

export type ReadStepResult =
  | {
      ok: true;
      done: boolean;
      pagesRead: number;
      pageCount: number;
      passages?: number;
    }
  | { ok: false; message: string };

export class ReadingError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly code: string,
  ) {
    super(code);
    this.name = "ReadingError";
  }
}

const SCAN_MESSAGES = {
  too_large:
    "Some pages are scanned, and the file is too large for them to be read (over about 22 MB). Split it into smaller files and upload them separately.",
  refused:
    "Claude declined to read some scanned pages. Check the file, then try again.",
  unavailable:
    "The scanned pages could not be read just now. Try again in a few minutes.",
  unreadable:
    "The scanned pages could not be read. Check the file is clear and not password-protected.",
} as const;

export type ReadStore = {
  // The file's bytes and how many pages are known so far (null: not looked at yet).
  open(): Promise<{ bytes: Uint8Array; pageCount: number | null } | null>;
  // Anything to do with the file before reading it (the library keeps an archive copy).
  beforeRead?(bytes: Uint8Array, kind: LibraryFileKind): Promise<void>;
  setPageCount(pageCount: number): Promise<void>;
  storedPages(): Promise<Set<number>>;
  insertPages(rows: PageRow[]): Promise<void>;
  loadPages(): Promise<PageRow[]>;
  savePassages(
    passages: Passage[],
    method: "text" | "scan" | "mixed",
    quality: number,
    pageCount: number,
  ): Promise<number>;
  // How many of these scanned pages may be read now (a student's monthly allowance), and a record
  // of the pages read. Without these, every page may be read.
  scanPagesAllowed?(wanted: number): Promise<number>;
  recordScanPages?(pages: number): Promise<void>;
  // The message when the allowance runs out part-way.
  allowanceMessage?: string;
};

// Does as much reading as fits in one request, then says how far it got. The caller asks again
// until it is done, so a long scan is read over several requests and can be resumed.
export async function readWithStore(
  store: ReadStore,
  userId: string,
): Promise<ReadStepResult> {
  const started = Date.now();
  const opened = await store.open();
  if (!opened) return { ok: false, message: "That file no longer exists." };
  const { bytes } = opened;
  const kind = detectFileKind(bytes);
  if (!kind)
    throw new ReadingError(
      "The file is not a PDF, Word, PNG or JPEG file.",
      "kind",
    );
  await store.beforeRead?.(bytes, kind);

  if (kind === "docx") {
    const blocks = await readDocxBlocks(bytes);
    const quality = readingQuality([
      blocks.map((block) => block.text).join(" "),
    ]);
    const passages = await savePassages(store, blocks, "text", quality, 0);
    return { ok: true, done: true, pagesRead: 0, pageCount: 0, passages };
  }

  let pageCount = opened.pageCount;
  if (pageCount === null) {
    pageCount = kind === "pdf" ? await storeTextLayer(store, bytes) : 1;
    await store.setPageCount(pageCount);
  }
  if (pageCount === 0)
    throw new ReadingError("This PDF has no pages.", "no_pages");

  const source: ScanSource =
    kind === "pdf"
      ? { kind: "pdf", base64: Buffer.from(bytes).toString("base64") }
      : {
          kind: "image",
          base64: Buffer.from(bytes).toString("base64"),
          mediaType: kind === "png" ? "image/png" : "image/jpeg",
        };

  let stored = await store.storedPages();
  let missing = missingPages(pageCount, stored);
  while (missing.length > 0 && Date.now() - started < STEP_BUDGET_MS) {
    let batch = nextBatch(missing);
    if (store.scanPagesAllowed) {
      const allowed = await store.scanPagesAllowed(batch.length);
      if (allowed <= 0)
        throw new ReadingError(
          store.allowanceMessage ?? "No scanned pages are left this month.",
          "scan_allowance",
        );
      batch = batch.slice(0, allowed);
    }
    const result = await transcribePages(
      source,
      batch[0],
      batch.at(-1) ?? batch[0],
      userId,
    );
    if (!result.ok)
      throw new ReadingError(
        SCAN_MESSAGES[result.reason],
        `scan_${result.reason}`,
      );
    await store.recordScanPages?.(batch.length);
    // In a complete reply, a page with no marker had no text.
    const done = result.complete
      ? batch
      : batch.filter((page) => result.pages.has(page));
    await store.insertPages(
      done.map((page) => ({
        page,
        text: (result.pages.get(page) ?? "").slice(0, PAGE_TEXT_MAX_CHARS),
        method: "scan" as const,
      })),
    );
    stored = await store.storedPages();
    missing = missingPages(pageCount, stored);
  }
  if (missing.length > 0)
    return { ok: true, done: false, pagesRead: stored.size, pageCount };

  const pages = await store.loadPages();
  const blocks = pages.flatMap((page) =>
    page.method === "scan"
      ? scanPageToBlocks(page.text, page.page)
      : pdfPageToBlocks(page.text, page.page),
  );
  const methods = new Set(pages.map((page) => page.method));
  const method = methods.size > 1 ? "mixed" : (pages[0]?.method ?? "text");
  const quality = readingQuality(pages.map((page) => page.text));
  const passages = await savePassages(
    store,
    blocks,
    method,
    quality,
    pageCount,
  );
  return { ok: true, done: true, pagesRead: pageCount, pageCount, passages };
}

// Stores the text of every PDF page that has a text layer; returns the number of pages.
async function storeTextLayer(
  store: ReadStore,
  bytes: Uint8Array,
): Promise<number> {
  let pdf;
  try {
    pdf = await readPdfText(bytes);
  } catch {
    throw new ReadingError(
      "The PDF could not be opened. It may be damaged or password-protected.",
      "pdf_open",
    );
  }
  const rows = pdf.pages
    .map((text, index) => ({
      page: index + 1,
      text: text.slice(0, PAGE_TEXT_MAX_CHARS),
      method: "text" as const,
    }))
    .filter((row) => !needsScan(row.text));
  for (let i = 0; i < rows.length; i += 200)
    await store.insertPages(rows.slice(i, i + 200));
  return pdf.pageCount;
}

async function savePassages(
  store: ReadStore,
  blocks: Block[],
  method: "text" | "scan" | "mixed",
  quality: number,
  pageCount: number,
): Promise<number> {
  const passages = splitIntoPassages(blocks);
  if (passages.length === 0)
    throw new ReadingError("No text was found in this file.", "no_text");
  return store.savePassages(passages, method, quality, pageCount);
}

export function missingPages(pageCount: number, stored: Set<number>): number[] {
  const missing: number[] = [];
  for (let page = 1; page <= pageCount; page++)
    if (!stored.has(page)) missing.push(page);
  return missing;
}

// The next few missing pages that follow on from each other (one Claude call).
export function nextBatch(missing: number[]): number[] {
  const batch = missing.slice(0, 1);
  for (const page of missing.slice(1)) {
    if (batch.length >= SCAN_BATCH_PAGES || page !== (batch.at(-1) ?? 0) + 1)
      break;
    batch.push(page);
  }
  return batch;
}
