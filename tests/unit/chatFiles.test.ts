import { describe, expect, it } from "vitest";
import { CHAT_MAX_FILES, chatFileProblem, clock, detectAudioKind, fileSize, isImage, kindLabel, voiceFormatFor } from "@/lib/chatFiles";

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

  it("knows voice notes by their first bytes, never their name", () => {
    expect(detectAudioKind(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2]))).toBe("webm");
    expect(detectAudioKind(new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0]))).toBe("ogg");
    expect(detectAudioKind(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41]))).toBe("m4a");
    expect(detectAudioKind(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
  it("names the recording format each browser makes, and shows lengths as m:ss", () => {
    expect(voiceFormatFor("audio/webm;codecs=opus")).toBe("webm");
    expect(voiceFormatFor("audio/mp4")).toBe("m4a");
    expect(voiceFormatFor("audio/ogg; codecs=opus")).toBe("ogg");
    expect(voiceFormatFor("audio/wav")).toBeNull();
    expect(clock(65.4)).toBe("1:05");
    expect(clock(120)).toBe("2:00");
    expect(kindLabel("voice")).toBe("Voice note");
  });
});
