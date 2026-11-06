import { describe, expect, it } from "vitest";
import { CHAT_MAX_FILES, chatFileProblem, fileSize, isImage, kindLabel } from "@/lib/chatFiles";

describe("chat files", () => {
  it("accepts PDF, Word, PNG and JPEG up to 25 MB", () => {
    for (const name of ["a.pdf", "b.DOCX", "c.png", "d.jpg", "e.jpeg"]) expect(chatFileProblem(name, 1000, 0)).toBeNull();
    expect(chatFileProblem("big.pdf", 25 * 1024 * 1024, 0)).toBeNull();
  });
  it("refuses other kinds, files over 25 MB, empty files and a fifth file", () => {
    expect(chatFileProblem("notes.doc", 1000, 0)).toMatch(/PDF, Word/);
    expect(chatFileProblem("run.exe", 1000, 0)).toMatch(/can’t be attached/);
    expect(chatFileProblem("big.pdf", 25 * 1024 * 1024 + 1, 0)).toMatch(/25 MB/);
    expect(chatFileProblem("empty.pdf", 0, 0)).toMatch(/empty/);
    expect(chatFileProblem("a.pdf", 1000, CHAT_MAX_FILES)).toMatch(/up to 4/);
  });
  it("shows sizes and kinds plainly", () => {
    expect(fileSize(512)).toBe("512 B");
    expect(fileSize(482_000)).toBe("471 KB");
    expect(fileSize(2 * 1024 * 1024)).toBe("2 MB");
    expect(fileSize(1_300_000)).toBe("1.2 MB");
    expect(isImage("jpeg")).toBe(true);
    expect(isImage("pdf")).toBe(false);
    expect(kindLabel("docx")).toBe("Word");
  });
});
