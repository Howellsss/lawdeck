import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  ADMIN_LIBRARY_MAX_BYTES,
  adminKindFromFileName,
  detectAdminLibraryKind,
  detectFileKind,
  isOldPowerPoint,
  LIBRARY_MAX_BYTES,
} from "@/lib/libraryFiles";
import { adminLibraryFileSchema, libraryFileSchema, libraryPathSchema } from "@/schemas/library";
import { uploadFileSchema } from "@/schemas/uploads";
import { decodeXml, readPptxSlides, slideText } from "@/server/library/pptx";

// Builds a real zip (as PowerPoint saves it) from named parts, compressed with deflate.
function zip(parts: Record<string, string>, stored = false): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(parts)) {
    const raw = encoder.encode(text);
    const data = stored ? raw : new Uint8Array(deflateRawSync(raw));
    const nameBytes = encoder.encode(name);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, stored ? 0 : 8, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    const entry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, stored ? 0 : 8, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    locals.push(local);
    central.push(entry);
    offset += local.length;
  }
  const dirSize = central.reduce((n, e) => n + e.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, dirSize, true);
  ev.setUint32(16, offset, true);
  const all = [...locals, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const shape = (text: string[], ph = "") =>
  `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody>${text
    .map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`)
    .join("")}</p:txBody></p:sp>`;
const slide = (title: string, lines: string[]) =>
  `<p:sld><p:cSld><p:spTree>${shape([title], '<p:ph type="title"/>')}${shape(lines)}</p:spTree></p:cSld></p:sld>`;

// Made-up lecture slides. Slide files are numbered out of order on purpose: the order comes from
// the presentation, as in real PowerPoint files after slides are moved.
function lecture(): Uint8Array {
  return zip({
    "[Content_Types].xml": "<Types/>",
    "ppt/presentation.xml": '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst></p:presentation>',
    "ppt/_rels/presentation.xml.rels":
      '<Relationships><Relationship Id="rId2" Target="slides/slide2.xml"/><Relationship Id="rId3" Target="slides/slide1.xml"/></Relationships>',
    "ppt/slides/slide2.xml": slide("Mortgages", ["A mortgage is security for a loan.", "Equity of redemption &amp; foreclosure"]),
    "ppt/slides/slide1.xml": slide("Remedies of the mortgagee", ["Sale, foreclosure and receivership."]),
    "ppt/slides/_rels/slide1.xml.rels": '<Relationships><Relationship Id="rId1" Target="../notesSlides/notesSlide1.xml"/></Relationships>',
    "ppt/notesSlides/notesSlide1.xml": `<p:notes><p:cSld><p:spTree>${shape(["Remind students of the 2015 Lagos law."], '<p:ph type="body"/>')}${shape(["2"], '<p:ph type="sldNum"/>')}</p:spTree></p:cSld></p:notes>`,
  });
}

describe("PowerPoint slides in the library", () => {
  it("reads every slide in presentation order, title first, with speaker notes", () => {
    const slides = readPptxSlides(lecture());
    expect(slides).toHaveLength(2);
    expect(slides[0]).toBe("# Mortgages\n\nA mortgage is security for a loan.\n\nEquity of redemption & foreclosure");
    expect(slides[1]).toContain("# Remedies of the mortgagee");
    expect(slides[1]).toContain("Speaker notes:\n\nRemind students of the 2015 Lagos law.");
    expect(slides[1]).not.toMatch(/\n2$/);
  });

  it("leaves out slide-number fields and decodes XML text", () => {
    const xml = `<p:sld>${shape(['Order 5 <a:fld type="slidenum"><a:t>9</a:t></a:fld>'])}</p:sld>`;
    expect(slideText(xml)).toBe("Order 5");
    expect(decodeXml("A &lt;B&gt; &#8212; &#x41;")).toBe("A <B> — A");
  });

  it("reads uncompressed parts too", () => {
    const stored = zip(
      {
        "ppt/presentation.xml": "<p:presentation/>",
        "ppt/slides/slide1.xml": slide("Probate", ["Grant of probate."]),
      },
      true,
    );
    expect(readPptxSlides(stored)).toEqual(["# Probate\n\nGrant of probate."]);
  });

  it("refuses files that are not PowerPoint, and parts that unpack too large", () => {
    expect(() => readPptxSlides(new TextEncoder().encode("not a zip at all"))).toThrow();
    expect(() => readPptxSlides(zip({ "word/document.xml": "<w:document/>" }))).toThrow();
    const bomb = zip({ "ppt/presentation.xml": "<p:presentation/>", "ppt/slides/slide1.xml": "a".repeat(25 * 1024 * 1024) });
    expect(() => readPptxSlides(bomb)).toThrow();
  });
});

describe("what the library and students may upload", () => {
  const pptx = lecture();

  it("lets admins add PowerPoint, never students", () => {
    expect(detectAdminLibraryKind(pptx)).toBe("pptx");
    expect(detectFileKind(pptx)).toBeNull();
    expect(adminKindFromFileName("Week 5 slides.PPTX")).toBe("pptx");
    expect(isOldPowerPoint("BAIL PENDING TRIAL.ppt")).toBe(true);
    expect(adminKindFromFileName("BAIL PENDING TRIAL.ppt")).toBeNull();
  });

  it("allows library files up to 100 MB, and keeps students at 25 MB", () => {
    expect(ADMIN_LIBRARY_MAX_BYTES).toBe(100 * 1024 * 1024);
    expect(LIBRARY_MAX_BYTES).toBe(25 * 1024 * 1024);
    const big = { fileName: "6 Sample Draft.pdf", size: 52_668_243, kind: "pdf" };
    expect(adminLibraryFileSchema.safeParse(big).success).toBe(true);
    expect(adminLibraryFileSchema.safeParse({ ...big, size: ADMIN_LIBRARY_MAX_BYTES + 1 }).success).toBe(false);
    expect(adminLibraryFileSchema.safeParse({ fileName: "slides.pptx", size: 4_000_000, kind: "pptx" }).success).toBe(true);
    expect(libraryFileSchema.safeParse(big).success).toBe(false);
    expect(uploadFileSchema.safeParse(big).success).toBe(false);
    expect(uploadFileSchema.safeParse({ fileName: "slides.pptx", size: 4_000_000, kind: "pptx" }).success).toBe(false);
  });

  it("stores slides at a checked path", () => {
    const id = "3f2b6d1e-8c4a-4e1f-9b2d-7a6c5e4d3b2a";
    expect(libraryPathSchema.safeParse(`${id}/${id}.pptx`).success).toBe(true);
    expect(libraryPathSchema.safeParse(`${id}/${id}.ppt`).success).toBe(false);
  });
});
