import "server-only";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { docxHtmlToBlocks, type Block } from "./blocks";

// A PDF page with fewer letters and digits than this is treated as a scan and read by Claude.
const SCAN_BELOW_CHARS = 40;

export type PdfText = { pageCount: number; pages: string[] };

// The text layer of every page of a PDF (empty for scanned pages).
export async function readPdfText(bytes: Uint8Array): Promise<PdfText> {
  // The PDF reader takes over the bytes it is given, so it gets a copy.
  const { totalPages, text } = await extractText(bytes.slice(), { mergePages: false });
  return { pageCount: totalPages, pages: text };
}

export function needsScan(pageText: string): boolean {
  return pageText.replace(/[^\p{L}\p{N}]/gu, "").length < SCAN_BELOW_CHARS;
}

// Headings and paragraphs of a Word file, using its real heading styles.
export async function readDocxBlocks(bytes: Uint8Array): Promise<Block[]> {
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
  return docxHtmlToBlocks(value);
}
