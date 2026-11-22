import "server-only";
import { inflateRawSync } from "node:zlib";

// Reads the text of a PowerPoint (.pptx) file for the library (founder, 2026-11-22: lecture slides).
// A .pptx is a zip of XML files; this reads it with Node's own zlib, no extra library. Each slide
// becomes one "page": its title as a "# " heading line, then each paragraph, then the speaker
// notes. Pictures and diagrams have no text and are not read.

export class PptxError extends Error {}

// Guards against a "zip bomb": no single part, and not all parts together, may unpack beyond these.
const MAX_PART_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
export const MAX_SLIDES = 2000;

type Entry = { method: number; compressedSize: number; size: number; offset: number };

function readEntries(bytes: Uint8Array): Map<string, Entry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-directory record sits in the last 64 KB (plus its own 22 bytes).
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new PptxError("not a zip");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries = new Map<string, Entry>();
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new PptxError("bad directory");
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    entries.set(name, {
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      offset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readPart(bytes: Uint8Array, entry: Entry, budget: { left: number }): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.offset;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) throw new PptxError("bad entry");
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  const limit = Math.min(MAX_PART_BYTES, budget.left);
  let out: Uint8Array;
  if (entry.method === 0) out = data;
  else if (entry.method === 8) {
    try {
      out = inflateRawSync(data, { maxOutputLength: limit });
    } catch {
      throw new PptxError("too large or damaged");
    }
  } else throw new PptxError("unsupported compression");
  if (out.length > limit) throw new PptxError("too large");
  budget.left -= out.length;
  return new TextDecoder().decode(out);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

// The paragraphs of one shape tree, as text. Slide numbers and dates (fields) are left out.
function paragraphs(xml: string): string[] {
  const out: string[] = [];
  for (const [, body] of xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p [^>]*>([\s\S]*?)<\/a:p>/g)) {
    const inner = (body ?? "").replace(/<a:fld\b[\s\S]*?<\/a:fld>/g, "");
    const runs = [...inner.matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:t [^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => m[1] ?? m[2] ?? "");
    const text = decodeXml(runs.join("")).replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

// One slide's text: the title shape first (as a heading), then the other shapes in order.
export function slideText(slideXml: string, notesXml?: string): string {
  const shapes = [...slideXml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>|<p:sp [^>]*>([\s\S]*?)<\/p:sp>/g)].map((m) => m[1] ?? m[2] ?? "");
  // Tables and grouped shapes keep their text in <a:p> too; anything outside <p:sp> is read last.
  const outside = slideXml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, "");
  let title: string | null = null;
  const body: string[] = [];
  for (const shape of shapes) {
    const lines = paragraphs(shape);
    if (!lines.length) continue;
    if (title === null && /<p:ph[^>]*type="(title|ctrTitle)"/.test(shape)) title = lines.join(" ");
    else body.push(...lines);
  }
  body.push(...paragraphs(outside));
  const parts: string[] = [];
  if (title) parts.push(`# ${title}`);
  parts.push(...body);
  if (notesXml) {
    // The notes page repeats the slide picture and number; only its text body is kept.
    const notes = [...notesXml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>|<p:sp [^>]*>([\s\S]*?)<\/p:sp>/g)]
      .map((m) => m[1] ?? m[2] ?? "")
      .filter((shape) => /<p:ph[^>]*type="body"/.test(shape))
      .flatMap(paragraphs);
    if (notes.length) parts.push("Speaker notes:", ...notes);
  }
  return parts.join("\n\n");
}

function relTargets(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) map.set(id, target);
  }
  return map;
}

// "slides/slide3.xml" relative to "ppt/" → "ppt/slides/slide3.xml"; "../notesSlides/x.xml" from ppt/slides/.
function resolve(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").filter(Boolean);
  for (const piece of target.split("/")) {
    if (piece === "..") parts.pop();
    else if (piece !== ".") parts.push(piece);
  }
  return parts.join("/");
}

// The text of every slide, in presentation order (one string per slide, possibly empty).
export function readPptxSlides(bytes: Uint8Array): string[] {
  const entries = readEntries(bytes);
  const budget = { left: MAX_TOTAL_BYTES };
  const part = (name: string) => {
    const entry = entries.get(name);
    return entry ? readPart(bytes, entry, budget) : undefined;
  };
  const presentation = part("ppt/presentation.xml");
  if (!presentation) throw new PptxError("no presentation");
  const rels = relTargets(part("ppt/_rels/presentation.xml.rels") ?? "");
  let order = [...presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)]
    .map((m) => rels.get(m[1]))
    .filter((target): target is string => !!target)
    .map((target) => resolve("ppt", target));
  if (!order.length) {
    order = [...entries.keys()]
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  }
  if (order.length > MAX_SLIDES) throw new PptxError("too many slides");
  return order.map((name) => {
    const xml = part(name) ?? "";
    const folder = name.slice(0, name.lastIndexOf("/"));
    const slideRels = relTargets(part(`${folder}/_rels/${name.slice(folder.length + 1)}.rels`) ?? "");
    const notesTarget = [...slideRels.values()].find((target) => /notesSlide\d+\.xml$/.test(target));
    const notes = notesTarget ? part(resolve(folder, notesTarget)) : undefined;
    return slideText(xml, notes);
  });
}
