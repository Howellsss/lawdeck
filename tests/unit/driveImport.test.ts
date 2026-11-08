import { afterEach, describe, expect, it, vi } from "vitest";
import { guessCourse, guessYear, titleFromFileName } from "@/lib/driveGuess";
import { driveImportSchema } from "@/schemas/library";
import { fetchDriveFile, resolveDriveLink } from "@/server/library/drive";

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
    const file = await fetchDriveFile({ token: "token-abc" }, "fileid12345");
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

  it("refuses Google Sheets and files over 25 MB without downloading them", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        meta({ name: "d", mimeType: "application/vnd.google-apps.spreadsheet" }),
      );
    vi.stubGlobal("fetch", fetchSpy);
    expect((await fetchDriveFile({ token: "t" }, "fileid12345")).ok).toBe(false);
    fetchSpy.mockResolvedValue(
      meta({
        name: "big.pdf",
        mimeType: "application/pdf",
        size: String(26 * 1024 * 1024),
      }),
    );
    expect(await fetchDriveFile({ token: "t" }, "fileid12345")).toEqual({
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
    expect(await fetchDriveFile({ token: "t" }, "fileid12345")).toEqual({
      ok: false,
      message: "Files must be 25 MB or smaller.",
    });
  });

  it("saves a Google Doc as PDF (founder, 2026-11-08)", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(meta({ name: "Civil Lit notes", mimeType: "application/vnd.google-apps.document" }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2])));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchDriveFile({ token: "t" }, "fileid12345")).toEqual({ ok: true, name: "Civil Lit notes.pdf", bytes: new Uint8Array([1, 2]) });
    expect(fetchSpy.mock.calls[1][0]).toContain("/export?mimeType=application%2Fpdf");
  });

  it("opens a pasted link with the server key, never sent as a token, and says when it is not shared", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(meta({ name: "a.pdf", mimeType: "application/pdf", size: "2" }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2])));
    vi.stubGlobal("fetch", fetchSpy);
    expect((await fetchDriveFile({ key: "server-key" }, "fileid12345")).ok).toBe(true);
    expect(fetchSpy.mock.calls[0][0]).toContain("key=server-key");
    expect(fetchSpy.mock.calls[0][1].headers).toBeUndefined();
    fetchSpy.mockResolvedValue(new Response("", { status: 404 }));
    const file = await fetchDriveFile({ key: "server-key" }, "fileid12345");
    expect(file.ok).toBe(false);
    if (!file.ok) expect(file.message).toContain("Anyone with the link");
  });

  it("lists the importable files in a shared folder and its sub-folders, up to the limit", async () => {
    const list = (files: object[]) => new Response(JSON.stringify({ files }));
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        list([
          { id: "sub-folder-1", name: "Week 2", mimeType: "application/vnd.google-apps.folder" },
          { id: "file-aaaaaaaa", name: "a.pdf", mimeType: "application/pdf", size: "10" },
          { id: "file-sheet-01", name: "marks", mimeType: "application/vnd.google-apps.spreadsheet" },
        ]),
      )
      .mockResolvedValueOnce(
        list([
          { id: "file-bbbbbbbb", name: "b.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: "20" },
          { id: "file-cccccccc", name: "c", mimeType: "application/vnd.google-apps.document" },
        ]),
      );
    vi.stubGlobal("fetch", fetchSpy);
    const found = await resolveDriveLink("server-key", { id: "folder-aaaaaaa", folder: true }, 2);
    expect(found).toEqual({ ok: true, files: [{ id: "file-aaaaaaaa", name: "a.pdf", sizeBytes: 10 }, { id: "file-bbbbbbbb", name: "b.docx", sizeBytes: 20 }] });
  });

  it("explains expired access plainly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );
    const file = await fetchDriveFile({ token: "t" }, "fileid12345");
    expect(file.ok).toBe(false);
    if (!file.ok) expect(file.message).toContain("Google access has ended");
  });
});

describe("Drive picker only on the live address (no Google origin_mismatch page)", () => {
  it("reads the live address from SITE_URL as an origin", async () => {
    const { liveOrigin } = await import("@/lib/driveOrigin");
    expect(liveOrigin("https://mylawdeck.com/")).toBe("https://mylawdeck.com");
    expect(liveOrigin("https://mylawdeck.com/some/path")).toBe("https://mylawdeck.com");
    // Test previews may have no SITE_URL: the live address is assumed.
    expect(liveOrigin(undefined)).toBe("https://mylawdeck.com");
    expect(liveOrigin("not a url")).toBe("https://mylawdeck.com");
  });

  it("opens the picker on the live address only", async () => {
    const { driveWorksHere } = await import("@/lib/driveOrigin");
    expect(driveWorksHere("https://mylawdeck.com", "https://mylawdeck.com")).toBe(true);
    expect(driveWorksHere("https://lawdeck-git-fix-x-howells1.vercel.app", "https://mylawdeck.com")).toBe(false);
    expect(driveWorksHere("https://lawdeck.vercel.app", "https://mylawdeck.com")).toBe(false);
    expect(driveWorksHere("https://www.mylawdeck.com", "https://mylawdeck.com")).toBe(false);
    // The developer's own computer is allowed.
    expect(driveWorksHere("http://localhost:3000", "https://mylawdeck.com")).toBe(true);
    expect(driveWorksHere("not a url", "https://mylawdeck.com")).toBe(false);
  });
});
