import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageRow, ReadStore } from "@/server/library/reader";

// A pretend Claude and search service: nothing is spent. Made-up text only.
const transcribePages = vi.fn();
const embedTexts = vi.fn();
vi.mock("@/server/ai/transcribe", () => ({ transcribePages }));
vi.mock("@/server/retrieval/voyage", () => ({
  EMBED_BATCH: 64,
  fitTokenBudget: (texts: string[]) => texts.length,
  toVectorText: (v: number[]) => `[${v.join(",")}]`,
  embedTexts,
}));
vi.mock("@/server/library/extract", () => ({
  readPdfText: async () => ({
    pageCount: 3,
    pages: [
      "Page one has plenty of readable words about quokka writs and renewals.",
      "",
      "",
    ],
  }),
  needsScan: (text: string) => text.trim().length < 20,
  readDocxBlocks: async () => [],
}));
const { readWithStore, ReadingError } = await import("@/server/library/reader");
const { uploadStep } = await import("@/server/uploads/reading");

const PDF = new TextEncoder().encode("%PDF-1.7 made-up");

// A store kept in memory, recording what the reader asks of it.
function memoryStore(
  over: Partial<ReadStore> & { allowance?: number | null } = {},
) {
  const pages = new Map<number, PageRow>();
  let pageCount: number | null = null;
  const scansRecorded: number[] = [];
  let saved: { passages: unknown[]; quality: number; pages: number } | null =
    null;
  let allowance = over.allowance === undefined ? null : over.allowance;
  const store: ReadStore = {
    open: async () => ({ bytes: PDF, pageCount }),
    setPageCount: async (n) => void (pageCount = n),
    storedPages: async () => new Set(pages.keys()),
    insertPages: async (rows) => rows.forEach((r) => pages.set(r.page, r)),
    loadPages: async () => [...pages.values()].sort((a, b) => a.page - b.page),
    savePassages: async (passages, _m, quality, n) => (
      (saved = { passages, quality, pages: n }),
      passages.length
    ),
    ...(allowance === null
      ? {}
      : {
          scanPagesAllowed: async (wanted: number) =>
            Math.min(wanted, allowance ?? wanted),
          recordScanPages: async (n: number) => {
            scansRecorded.push(n);
            allowance = (allowance ?? 0) - n;
          },
          allowanceMessage: "No scanned pages left.",
        }),
    ...over,
  };
  return { store, pages, scansRecorded, saved: () => saved };
}

const scanReply = (pages: number[]) => ({
  ok: true,
  complete: true,
  pages: new Map(
    pages.map((p) => [
      p,
      `# Scanned heading ${p}\n\nScanned text for page ${p} about wombat renewals and service of process.`,
    ]),
  ),
});

beforeEach(() => {
  transcribePages.mockReset();
  embedTexts.mockReset();
});

describe("the shared reader", () => {
  it("keeps text pages, scans only the pages without text, then saves passages", async () => {
    transcribePages.mockImplementation(async (_s, from: number, to: number) =>
      scanReply(Array.from({ length: to - from + 1 }, (_, i) => from + i)),
    );
    const mem = memoryStore();
    const result = await readWithStore(mem.store, "u1");
    expect(result).toMatchObject({ ok: true, done: true, pageCount: 3 });
    expect(transcribePages).toHaveBeenCalledTimes(1);
    expect(transcribePages.mock.calls[0].slice(1, 3)).toEqual([2, 3]);
    expect([...mem.pages.values()].map((p) => p.method)).toEqual([
      "text",
      "scan",
      "scan",
    ]);
    expect(mem.saved()?.pages).toBe(3);
  });

  it("stops at the scanned-page allowance, keeps what it read, and does not pay twice", async () => {
    transcribePages.mockImplementation(async (_s, from: number, to: number) =>
      scanReply(Array.from({ length: to - from + 1 }, (_, i) => from + i)),
    );
    const mem = memoryStore({ allowance: 1 });
    await expect(readWithStore(mem.store, "u1")).rejects.toThrow(ReadingError);
    expect(transcribePages.mock.calls.map((c) => c.slice(1, 3))).toEqual([
      [2, 2],
    ]);
    expect(mem.scansRecorded).toEqual([1]);
    expect(mem.pages.has(2)).toBe(true);
    // Next month: carries on from page 3 only.
    transcribePages.mockClear();
    const nextMonth = memoryStore();
    for (const [page, row] of mem.pages) nextMonth.pages.set(page, row);
    nextMonth.store.open = async () => ({ bytes: PDF, pageCount: 3 });
    expect(await readWithStore(nextMonth.store, "u1")).toMatchObject({
      ok: true,
      done: true,
    });
    expect(transcribePages.mock.calls.map((c) => c.slice(1, 3))).toEqual([
      [3, 3],
    ]);
  });

  it("reports a file that is not a PDF, Word or image", async () => {
    const mem = memoryStore({
      open: async () => ({
        bytes: new TextEncoder().encode("MZ"),
        pageCount: null,
      }),
    });
    await expect(readWithStore(mem.store, "u1")).rejects.toMatchObject({
      userMessage: "The file is not a PDF, Word, PNG or JPEG file.",
    });
  });
});

// A pretend database for one student's upload.
function fakeDb(state: {
  pages: PageRow[];
  passages: {
    id: string;
    heading: string | null;
    text: string;
    embedding_model: string | null;
  }[];
}) {
  const calls: { fn: string; args: unknown }[] = [];
  const db = {
    calls,
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      if (fn === "replace_upload_passages") {
        state.passages = (
          (args as { passages: { heading: string | null; text: string }[] })
            .passages ?? []
        ).map((p, i) => ({
          id: `p${i}`,
          heading: p.heading,
          text: p.text,
          embedding_model: null,
        }));
        return { data: state.passages.length, error: null };
      }
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob([PDF]), error: null }),
      }),
    },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const result = () =>
        table === "uploads"
          ? { data: { storage_path: "u1/f.pdf", page_count: 3 }, error: null }
          : table === "upload_pages"
            ? { data: state.pages, error: null }
            : {
                data: state.passages.filter((p) => p.embedding_model === null),
                error: null,
              };
      for (const name of ["select", "eq", "order", "or", "limit"])
        chain[name] = () => chain;
      chain.range = async () => result();
      chain.maybeSingle = async () => result();
      chain.then = (resolve: (v: unknown) => void) => resolve(result());
      chain.upsert = async () => ({ error: null });
      chain.update = (row: { embedding_model: string }) => ({
        eq: async (_c: string, id: string) => {
          const p = state.passages.find((x) => x.id === id);
          if (p) p.embedding_model = row.embedding_model;
          return { error: null };
        },
      });
      return chain;
    },
  };
  return db;
}

const textPages: PageRow[] = [1, 2, 3].map((page) => ({
  page,
  method: "text",
  text: `Readable notes on page ${page} about wombat writs, their renewal and service.`,
}));

describe("reading a student's upload", () => {
  it("reads, indexes and marks the file Ready", async () => {
    embedTexts.mockImplementation(async (texts: string[]) => ({
      ok: true,
      vectors: texts.map(() => [0.1, 0.2]),
    }));
    const db = fakeDb({ pages: textPages, passages: [] });
    expect(await uploadStep(db as never, "f1", "u1")).toMatchObject({
      ok: true,
      done: true,
    });
    expect(db.calls.map((c) => c.fn)).toEqual([
      "replace_upload_passages",
      "finish_upload_reading",
    ]);
    expect(embedTexts).toHaveBeenCalled();
  });

  it("still finishes without a search key (words search works)", async () => {
    embedTexts.mockResolvedValue({ ok: false, reason: "no_key" });
    const db = fakeDb({ pages: textPages, passages: [] });
    expect(await uploadStep(db as never, "f1", "u1")).toMatchObject({
      ok: true,
      done: true,
    });
  });

  it("records the reason when indexing fails, so the student can try again", async () => {
    embedTexts.mockResolvedValue({ ok: false, reason: "refused" });
    const db = fakeDb({ pages: textPages, passages: [] });
    const result = await uploadStep(db as never, "f1", "u1");
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining("Try again"),
    });
    expect(db.calls.at(-1)).toMatchObject({ fn: "fail_upload_reading" });
    expect(db.calls.some((c) => c.fn === "finish_upload_reading")).toBe(false);
  });
});
