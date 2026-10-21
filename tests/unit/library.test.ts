import { describe, expect, it } from "vitest";
import { detectFileKind, kindFromFileName } from "@/lib/libraryFiles";
import { libraryDetailsSchema, libraryFileSchema, libraryPathSchema } from "@/schemas/library";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === "string" ? Array.from(v, (c) => c.charCodeAt(0)) : [v])));

describe("real file type, from the contents", () => {
  it("recognises PDF, PNG, JPEG and DOCX", () => {
    expect(detectFileKind(bytes("%PDF-1.7 ..."))).toBe("pdf");
    expect(detectFileKind(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("png");
    expect(detectFileKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(detectFileKind(bytes("PK", 3, 4, "....[Content_Types].xml....word/document.xml"))).toBe("docx");
  });

  it("rejects look-alikes and anything else", () => {
    expect(detectFileKind(bytes("PK", 3, 4, "....xl/workbook.xml"))).toBeNull(); // an Excel file
    expect(detectFileKind(bytes("MZ", 0x90, 0))).toBeNull(); // a Windows program
    expect(detectFileKind(bytes("<html>%PDF-"))).toBeNull();
    expect(detectFileKind(new Uint8Array())).toBeNull();
  });
});

describe("type from the file name (quick check only)", () => {
  it("maps known extensions", () => {
    expect(kindFromFileName("Notes 2021.PDF")).toBe("pdf");
    expect(kindFromFileName("draft.docx")).toBe("docx");
    expect(kindFromFileName("scan.jpg")).toBe("jpeg");
    expect(kindFromFileName("old.doc")).toBeNull();
    expect(kindFromFileName("noextension")).toBeNull();
  });
});

describe("library details", () => {
  const valid = {
    title: "  Civil   Procedure notes ",
    type: "note",
    courseId: "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a",
    campus: "",
    year: "2023",
    source: " Lecturer handout ",
  };

  it("tidies text and turns blanks into nothing", () => {
    const parsed = libraryDetailsSchema.parse(valid);
    expect(parsed.title).toBe("Civil Procedure notes");
    expect(parsed.campus).toBeNull();
    expect(parsed.year).toBe(2023);
    expect(parsed.source).toBe("Lecturer handout");
  });

  it("requires a title, a known type and a course", () => {
    expect(libraryDetailsSchema.safeParse({ ...valid, title: " " }).success).toBe(false);
    expect(libraryDetailsSchema.safeParse({ ...valid, type: "blog" }).success).toBe(false);
    expect(libraryDetailsSchema.safeParse({ ...valid, courseId: "civil" }).success).toBe(false);
  });

  it("checks the year", () => {
    expect(libraryDetailsSchema.parse({ ...valid, year: "" }).year).toBeNull();
    expect(libraryDetailsSchema.safeParse({ ...valid, year: "1850" }).success).toBe(false);
    expect(libraryDetailsSchema.safeParse({ ...valid, year: "20x3" }).success).toBe(false);
  });

  it("limits files to 25 MB and the four types", () => {
    expect(libraryFileSchema.safeParse({ fileName: "a.pdf", size: 25 * 1024 * 1024, kind: "pdf" }).success).toBe(true);
    expect(libraryFileSchema.safeParse({ fileName: "a.pdf", size: 25 * 1024 * 1024 + 1, kind: "pdf" }).success).toBe(false);
    expect(libraryFileSchema.safeParse({ fileName: "a.pdf", size: 0, kind: "pdf" }).success).toBe(false);
    expect(libraryFileSchema.safeParse({ fileName: "a.exe", size: 10, kind: "exe" }).success).toBe(false);
  });

  it("only accepts storage paths the server itself makes", () => {
    const ok = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.pdf";
    expect(libraryPathSchema.safeParse(ok).success).toBe(true);
    expect(libraryPathSchema.safeParse("../secrets.pdf").success).toBe(false);
    expect(libraryPathSchema.safeParse(`${ok}/../x.pdf`).success).toBe(false);
  });
});
