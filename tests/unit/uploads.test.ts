import { beforeEach, describe, expect, it, vi } from "vitest";

// A pretend sign-in, database and file store: nothing real is touched.
const USER = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER = "bbbbbbbb-0000-4000-8000-000000000002";
const FILE_ID = "cccccccc-0000-4000-8000-000000000003";
const account = vi.fn();
const rpc = vi.fn();
const download = vi.fn();
const remove = vi.fn();
const insert = vi.fn();
const order: string[] = [];
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("@/server/auth/session", () => ({ getCurrentAccount: account }));
vi.mock("@/server/auth/supabase", () => ({
  createSupabaseServerClient: async () => ({
    rpc,
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => ({
          data: { signedUrl: `https://store/${path}` },
          error: null,
        }),
        download,
        remove: async (paths: string[]) => (order.push("file"), remove(paths)),
        list: async () => ({ data: [], error: null }),
      }),
    },
    from: () => ({
      insert: (row: unknown) => ({
        select: () => ({ single: async () => insert(row) }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { storage_path: `${USER}/${FILE_ID}.pdf` },
            error: null,
          }),
        }),
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: [], error: null }),
      }),
      delete: () => ({
        eq: () => ({
          select: async () => (
            order.push("row"),
            { data: [{ id: FILE_ID }], error: null }
          ),
        }),
      }),
    }),
  }),
}));
const { startUpload, finishUpload, deleteUpload } =
  await import("@/server/uploads/actions");

const PDF = new TextEncoder().encode("%PDF-1.7 made-up");
const blob = (bytes: Uint8Array) => ({
  data: new Blob([bytes as BlobPart]),
  error: null,
});
const details = { fileName: "My notes.pdf", size: PDF.length, kind: "pdf" };
const path = `${USER}/${FILE_ID}.pdf`;

beforeEach(() => {
  for (const fn of [account, rpc, download, remove, insert]) fn.mockReset();
  order.length = 0;
  account.mockResolvedValue({ id: USER });
  rpc.mockResolvedValue({ data: true, error: null });
  remove.mockReturnValue({ error: null });
  insert.mockResolvedValue({ data: { id: FILE_ID }, error: null });
});

describe("starting an upload", () => {
  it("needs sign-in and the accepted notice", async () => {
    account.mockResolvedValue(null);
    expect((await startUpload(details)).ok).toBe(false);
    account.mockResolvedValue({ id: USER });
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await startUpload(details)).toMatchObject({
      ok: false,
      needsNotice: true,
    });
  });

  it("refuses the wrong type or size before anything is stored", async () => {
    expect(await startUpload({ ...details, kind: "exe" })).toMatchObject({
      ok: false,
    });
    expect(await startUpload({ ...details, size: 26 * 1024 * 1024 })).toEqual({
      ok: false,
      message: "Files must be 25 MB or smaller.",
    });
  });

  it("gives a one-time link inside the student's own folder", async () => {
    const result = await startUpload(details);
    expect(result.ok && result.path).toMatch(
      new RegExp(`^${USER}/[0-9a-f-]{36}\\.pdf$`),
    );
  });
});

describe("finishing an upload", () => {
  it("refuses a path outside the student's own folder", async () => {
    expect(
      (await finishUpload({ ...details, path: `${OTHER}/${FILE_ID}.pdf` })).ok,
    ).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it("removes a file that is not really what its name says", async () => {
    download.mockResolvedValue(blob(new TextEncoder().encode("MZ not a pdf")));
    expect(await finishUpload({ ...details, path })).toMatchObject({
      ok: false,
      message: expect.stringContaining("not a real PDF"),
    });
    expect(remove).toHaveBeenCalledWith([path]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("records a real file with its real type and size", async () => {
    download.mockResolvedValue(blob(PDF));
    expect(await finishUpload({ ...details, path })).toEqual({
      ok: true,
      id: FILE_ID,
    });
    expect(insert).toHaveBeenCalledWith({
      file_name: "My notes.pdf",
      mime_type: "application/pdf",
      size_bytes: PDF.length,
      storage_path: path,
    });
  });

  it("removes the file and explains when the plan's limit is reached", async () => {
    download.mockResolvedValue(blob(PDF));
    insert.mockResolvedValue({ data: null, error: { code: "23514" } });
    expect(await finishUpload({ ...details, path })).toMatchObject({
      ok: false,
      message: expect.stringContaining("limit of files"),
    });
    expect(remove).toHaveBeenCalledWith([path]);
  });
});

describe("deleting an upload", () => {
  it("removes the file, then its record (and so its passages)", async () => {
    expect(await deleteUpload(FILE_ID)).toEqual({ ok: true });
    expect(order).toEqual(["file", "row"]);
  });

  it("keeps the record if the file could not be removed, and says so", async () => {
    remove.mockReturnValue({ error: { name: "StorageError" } });
    expect(await deleteUpload(FILE_ID)).toEqual({
      ok: false,
      message: "The file was not deleted. Please try again.",
    });
    expect(order).toEqual(["file"]);
  });

  it("refuses an id that is not a file id", async () => {
    expect((await deleteUpload("not-an-id")).ok).toBe(false);
  });
});
