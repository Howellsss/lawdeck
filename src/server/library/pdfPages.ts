import "server-only";
import { PDFDocument } from "pdf-lib";

// Large scanned PDFs (founder, 2026-11-22: a 52.7 MB book of sample drafts). Claude accepts at most
// about 22 MB of PDF in one request, so a bigger scanned file is cut into a small PDF of just the
// pages being read. Uses pdf-lib (approved by the founder, 2026-11-22), server-only.

export type OpenPdf = PDFDocument;

export async function openPdf(bytes: Uint8Array): Promise<OpenPdf> {
  return PDFDocument.load(bytes, { updateMetadata: false });
}

// A new PDF holding pages `from` to `to` (1-based, inclusive) of `pdf`.
export async function pdfOfPages(pdf: OpenPdf, from: number, to: number): Promise<Uint8Array> {
  const part = await PDFDocument.create();
  const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
  for (const page of await part.copyPages(pdf, indices)) part.addPage(page);
  return part.save();
}
