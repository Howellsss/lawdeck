import { beforeEach, describe, expect, it, vi } from "vitest";

// A pretend server and file store: nothing real is touched.
const startUpload = vi.fn();
const finishUpload = vi.fn();
const uploadFile = vi.fn();
const readUploadUntilDone = vi.fn();
vi.mock("@/server/uploads/actions", () => ({ startUpload, finishUpload }));
vi.mock("@/components/library/uploadFile", () => ({ uploadFile }));
vi.mock("@/components/uploads/readUpload", () => ({ readUploadUntilDone }));
const { uploadAndRead } = await import("@/components/uploads/uploadAndRead");

const pdf = (bytes = 10, name = "notes.pdf") => new File([new Uint8Array(bytes)], name);
const progress: string[] = [];
const onProgress = (text: string) => progress.push(text);

beforeEach(() => {
  for (const fn of [startUpload, finishUpload, uploadFile, readUploadUntilDone]) fn.mockReset();
  progress.length = 0;
  startUpload.mockResolvedValue({ ok: true, path: "me/f.pdf", signedUrl: "https://store/x" });
  uploadFile.mockImplementation(async (_u: string, _f: File, _k: string, report: (n: number) => void) => report(100));
  finishUpload.mockResolvedValue({ ok: true, id: "f1" });
  readUploadUntilDone.mockResolvedValue({ ok: true, passages: 4 });
});

describe("attaching a file", () => {
  it("refuses an empty, too large or wrong-type file before anything is sent", async () => {
    expect(await uploadAndRead(pdf(0), "k", onProgress)).toMatchObject({ ok: false });
    expect(await uploadAndRead(pdf(26 * 1024 * 1024), "k", onProgress)).toEqual({ ok: false, message: "Files must be 25 MB or smaller." });
    expect(await uploadAndRead(pdf(10, "virus.exe"), "k", onProgress)).toMatchObject({ ok: false });
    expect(startUpload).not.toHaveBeenCalled();
  });

  it("uploads, then reads the file so answers can use it", async () => {
    expect(await uploadAndRead(pdf(), "k", onProgress)).toEqual({ ok: true, id: "f1" });
    expect(startUpload).toHaveBeenCalledWith({ fileName: "notes.pdf", size: 10, kind: "pdf" });
    expect(finishUpload).toHaveBeenCalledWith({ fileName: "notes.pdf", size: 10, kind: "pdf", path: "me/f.pdf" });
    expect(readUploadUntilDone).toHaveBeenCalledWith("f1", onProgress);
    expect(progress).toEqual(["Uploading… 0%", "Uploading… 100%", "Reading…"]);
  });

  it("asks for the upload notice first when it has not been accepted", async () => {
    startUpload.mockResolvedValue({ ok: false, message: "Read the notice.", needsNotice: true });
    expect(await uploadAndRead(pdf(), "k", onProgress)).toMatchObject({ ok: false, needsNotice: true });
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("says where to carry on if reading stops after the upload", async () => {
    readUploadUntilDone.mockResolvedValue({ ok: false, message: "Reading is taking too long." });
    const result = await uploadAndRead(pdf(), "k", onProgress);
    expect(result).toMatchObject({ ok: false, uploadedId: "f1", message: expect.stringContaining("My uploads") });
  });

  it("explains a dropped connection", async () => {
    uploadFile.mockRejectedValue(new Error("upload"));
    expect(await uploadAndRead(pdf(), "k", onProgress)).toEqual({ ok: false, message: "The upload stopped. Check your connection and try again." });
    expect(finishUpload).not.toHaveBeenCalled();
  });
});
