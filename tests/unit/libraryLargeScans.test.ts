import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageRow, ReadStore } from "@/server/library/reader";

// A pretend Claude: nothing is spent. The size limit is made tiny so that a small test PDF counts
// as "too big to send whole", like the founder's 52.7 MB scanned book of sample drafts.
const transcribePages = vi.fn();
vi.mock("@/server/ai/transcribe", () => ({ transcribePages, SCAN_MAX_BASE64_CHARS: 100 }));
vi.mock("@/server/library/extract", () => ({
  // Every page is scanned (no text layer).
  readPdfText: async () => ({ pageCount: 5, pages: ["", "", "", "", ""] }),
  needsScan: () => true,
  readDocxBlocks: async () => [],
}));
const { readWithStore } = await import("@/server/library/reader");

async function scannedBook(pages: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage([200, 200]);
  return pdf.save();
}

function memoryStore(bytes: Uint8Array) {
  const pages = new Map<number, PageRow>();
  let pageCount: number | null = null;
  let saved: { passages: number; pages: number } | null = null;
  const store: ReadStore = {
    open: async () => ({ bytes, pageCount }),
    setPageCount: async (n) => void (pageCount = n),
    storedPages: async () => new Set(pages.keys()),
    insertPages: async (rows) => rows.forEach((r) => pages.set(r.page, r)),
    loadPages: async () => [...pages.values()].sort((a, b) => a.page - b.page),
    savePassages: async (passages, _m, _q, n) => ((saved = { passages: passages.length, pages: n }), passages.length),
  };
  return { store, pages, saved: () => saved };
}

// Claude reads the small PDF it is given; its pages are numbered from 1.
transcribePages.mockImplementation(async (_source, from: number, to: number) => ({
  ok: true,
  complete: true,
  pages: new Map(
    Array.from({ length: to - from + 1 }, (_, i) => [from + i, `# Part ${from + i}\n\nScanned text of this part about deeds of assignment.`]),
  ),
}));

beforeEach(() => transcribePages.mockClear());

describe("large scanned PDFs", () => {
  it("sends only a few pages at a time, as a small PDF, and keeps the real page numbers", async () => {
    const { store, pages, saved } = memoryStore(await scannedBook(5));
    const result = await readWithStore(store, "user-1");
    expect(result).toMatchObject({ ok: true, done: true, pageCount: 5 });
    // Two calls: pages 1–3, then 4–5, each asked for as pages 1..n of its own small PDF.
    expect(transcribePages.mock.calls.map((call) => [call[1], call[2]])).toEqual([[1, 3], [1, 2]]);
    for (const [source] of transcribePages.mock.calls) {
      const part = await PDFDocument.load(Buffer.from(source.base64, "base64"));
      expect(part.getPageCount()).toBeLessThanOrEqual(3);
    }
    expect([...pages.keys()]).toEqual([1, 2, 3, 4, 5]);
    // Page 5 of the book is page 2 of the second small PDF.
    expect(pages.get(5)?.text).toContain("# Part 2");
    expect(saved()?.pages).toBe(5);
  });
});
