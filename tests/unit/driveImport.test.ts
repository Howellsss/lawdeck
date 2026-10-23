import { afterEach, describe, expect, it, vi } from "vitest";
import { guessCourse, guessYear, titleFromFileName } from "@/lib/driveGuess";
import { driveImportSchema } from "@/schemas/library";
import { fetchDriveFile } from "@/server/library/drive";

const courses = [
  { id: "civ", name: "Civil Litigation" },
  { id: "crim", name: "Criminal Litigation" },
  { id: "prop", name: "Property Law Practice" },
  { id: "corp", name: "Corporate Law Practice" },
  { id: "lip", name: "Law in Practice" },
];

describe("suggestions from the file name", () => {
  it("finds the course from its own distinctive word, allowing a small spelling slip", () => {
    expect(
      guessCourse("REVIEW CIVIL LITIGATION HANDBOOK 2025.docx", courses),
    ).toBe("civ");
    expect(
      guessCourse("REVIEW CRIMINAL LITIGATION HANDBOOK 2025.docx", courses),
    ).toBe("crim");
    expect(
      guessCourse(
        "+++PROPERTY LAW PRACTICE HANDBOOK 2025 REVIEW.docx",
        courses,
      ),
    ).toBe("prop");
    expect(
      guessCourse(
        "REVIEW COOPORATE LAW PRACTICES HANDBOOK 2022 (1)-1[1].docx",
        courses,
      ),
    ).toBe("corp");
  });

  it("makes no guess when the name doesn't say, or says two courses", () => {
    expect(
      guessCourse("REVIEW PROF ETHICS HANDBOOK 2025 NEW.docx", courses),
    ).toBeNull();
    expect(guessCourse("Civil and criminal compared.pdf", courses)).toBeNull();
  });

  it("puts ethics files in Law in Practice (Professional Ethics) once the name says so", () => {
    const renamed = courses.map((course) =>
      course.id === "lip"
        ? { ...course, name: "Law in Practice (Professional Ethics)" }
        : course,
    );
    expect(
      guessCourse("REVIEW PROF ETHICS HANDBOOK 2025 NEW.docx", renamed),
    ).toBe("lip");
    expect(guessCourse("Professional Ethics notes.pdf", renamed)).toBe("lip");
    expect(
      guessCourse("REVIEW CIVIL LITIGATION HANDBOOK 2025.docx", renamed),
    ).toBe("civ");
  });

  it("finds the year", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    expect(
      guessYear(
        "REVIEW COOPORATE LAW PRACTICES HANDBOOK 2022 (1)-1[1].docx",
        now,
      ),
    ).toBe("2022");
    expect(guessYear("notes 2019 revised 2024.pdf", now)).toBe("2024");
    expect(guessYear("scan 20250.pdf", now)).toBe("");
    expect(guessYear("plan 2099.pdf", now)).toBe("");
  });

  it("makes a tidy title", () => {
    expect(
      titleFromFileName(
        "REVIEW COOPORATE LAW PRACTICES HANDBOOK 2022 (1)-1[1].docx",
      ),
    ).toBe("REVIEW COOPORATE LAW PRACTICES HANDBOOK 2022");
    expect(
      titleFromFileName("+++PROPERTY LAW PRACTICE HANDBOOK 2025 REVIEW.docx"),
    ).toBe("PROPERTY LAW PRACTICE HANDBOOK 2025 REVIEW");
    expect(titleFromFileName(".docx")).toBe("Untitled");
  });
});

describe("Drive import input", () => {
  const details = {
    title: "Notes",
    type: "note",
    courseId: "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a",
    campus: "",
    year: "2025",
    source: "",
  };

  it("accepts a picked file with valid details", () => {
    expect(
      driveImportSchema.safeParse({
        accessToken: "x".repeat(40),
        fileId: "1c7rcB9Wlic7EvsUM9M7DUPARLZTpLNHr",
        details,
      }).success,
    ).toBe(true);
  });

  it("refuses odd file ids and missing tokens", () => {
    expect(
      driveImportSchema.safeParse({
        accessToken: "x".repeat(40),
        fileId: "../etc/passwd",
        details,
      }).success,
    ).toBe(false);
    expect(
      driveImportSchema.safeParse({
        accessToken: "",
        fileId: "1c7rcB9Wlic7EvsUM9M7DUPARLZTpLNHr",
        details,
      }).success,
    ).toBe(false);
  });
});

describe("fetching from Google Drive", () => {
  afterEach(() => vi.unstubAllGlobals());
  const meta = (body: object) => new Response(JSON.stringify(body));

  it("downloads a picked file with the picker's token", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        meta({ name: "a.pdf", mimeType: "application/pdf", size: "4" }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4])));
    vi.stubGlobal("fetch", fetchSpy);
    const file = await fetchDriveFile("token-abc", "fileid12345");
    expect(file).toEqual({
      ok: true,
      name: "a.pdf",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });
    expect(fetchSpy.mock.calls[1][0]).toContain("alt=media");
    expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer token-abc",
    );
  });

  it("refuses Google Docs and files over 25 MB without downloading them", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        meta({ name: "d", mimeType: "application/vnd.google-apps.document" }),
      );
    vi.stubGlobal("fetch", fetchSpy);
    expect((await fetchDriveFile("t", "fileid12345")).ok).toBe(false);
    fetchSpy.mockResolvedValue(
      meta({
        name: "big.pdf",
        mimeType: "application/pdf",
        size: String(26 * 1024 * 1024),
      }),
    );
    expect(await fetchDriveFile("t", "fileid12345")).toEqual({
      ok: false,
      message: "Files must be 25 MB or smaller.",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("stops a download that turns out larger than 25 MB", async () => {
    const big = new Uint8Array(26 * 1024 * 1024);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          meta({ name: "a.pdf", mimeType: "application/pdf" }),
        )
        .mockResolvedValueOnce(new Response(big)),
    );
    expect(await fetchDriveFile("t", "fileid12345")).toEqual({
      ok: false,
      message: "Files must be 25 MB or smaller.",
    });
  });

  it("explains expired access plainly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );
    const file = await fetchDriveFile("t", "fileid12345");
    expect(file.ok).toBe(false);
    if (!file.ok) expect(file.message).toContain("Google access has ended");
  });
});
