import { describe, expect, it } from "vitest";
import { parseDriveLink, parseDriveLinks } from "@/lib/driveLinks";

// Made-up Drive ids.
const F = "1AbCdEfGhIjKlMnOpQrStUv";
const D = "0BxYzFolder1234567890";

describe("pasted Google Drive links", () => {
  it("reads file, folder and Google Docs links", () => {
    expect(parseDriveLink(`https://drive.google.com/file/d/${F}/view?usp=sharing`)).toEqual({ id: F, folder: false });
    expect(parseDriveLink(`https://drive.google.com/open?id=${F}`)).toEqual({ id: F, folder: false });
    expect(parseDriveLink(`https://drive.google.com/uc?id=${F}&export=download`)).toEqual({ id: F, folder: false });
    expect(parseDriveLink(`https://drive.google.com/drive/folders/${D}?usp=sharing`)).toEqual({ id: D, folder: true });
    expect(parseDriveLink(`https://drive.google.com/drive/u/1/folders/${D}`)).toEqual({ id: D, folder: true });
    expect(parseDriveLink(`https://docs.google.com/document/d/${F}/edit`)).toEqual({ id: F, folder: false });
  });

  it("refuses anything that is not a Google Drive link", () => {
    expect(parseDriveLink(`https://evil.example/file/d/${F}/view`)).toBeNull();
    expect(parseDriveLink(`http://drive.google.com/file/d/${F}/view`)).toBeNull();
    expect(parseDriveLink("https://drive.google.com/file/d/short/view")).toBeNull();
    expect(parseDriveLink("not a link")).toBeNull();
  });

  it("takes many links at once, drops repeats and lists what it could not read", () => {
    const text = `https://drive.google.com/file/d/${F}/view\nhttps://drive.google.com/open?id=${F}, https://drive.google.com/drive/folders/${D}  hello`;
    expect(parseDriveLinks(text)).toEqual({ links: [{ id: F, folder: false }, { id: D, folder: true }], notUnderstood: ["hello"] });
  });
});
