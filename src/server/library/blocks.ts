import "server-only";

// A heading or a paragraph read from a library file, with the page it came from
// (null for Word files, which have no fixed pages).
export type Block = { kind: "heading" | "text"; text: string; page: number | null };

const HEADING_MAX_CHARS = 120;
// "Part 2", "Chapter IV", "Order 5", "Rule 3", "Section 12", "Article 7", "Schedule 1".
const NAMED_HEADING = /^(part|chapter|order|rule|section|article|schedule|division|title)\s+([0-9]+[a-z]?|[ivxlc]+)\b/i;
// "1. Introduction", "2.3 Service out of jurisdiction" (short, no full stop at the end).
const NUMBERED_HEADING = /^\d+(\.\d+)*\.?\s+\S/;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Whether a line of PDF text looks like a heading. PDFs keep no headings, so this is a guess
// from the line's shape; reviewers can correct headings later (step 2e).
export function isHeadingLine(line: string): boolean {
  const text = clean(line);
  if (text.length < 2 || text.length > HEADING_MAX_CHARS || /[.,;]$/.test(text)) return false;
  if (NAMED_HEADING.test(text)) return true;
  if (NUMBERED_HEADING.test(text) && text.length <= 80 && text.split(" ").length <= 10) return true;
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

// Text from one PDF page: lines joined into paragraphs, with heading lines kept separate.
export function pdfPageToBlocks(pageText: string, page: number): Block[] {
  const blocks: Block[] = [];
  let paragraph = "";
  const flush = () => {
    if (paragraph.trim()) blocks.push({ kind: "text", text: clean(paragraph), page });
    paragraph = "";
  };
  for (const raw of pageText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (isHeadingLine(line)) {
      flush();
      blocks.push({ kind: "heading", text: clean(line), page });
      continue;
    }
    // Rejoin a word broken across lines ("appli-\ncation"), otherwise join with a space.
    paragraph = /[a-z]-$/.test(paragraph) && /^[a-z]/.test(line) ? paragraph.slice(0, -1) + line : `${paragraph} ${line}`;
  }
  flush();
  return blocks;
}

// Text Claude read from a scanned page: headings start with "# ", paragraphs are separated
// by blank lines (the format asked for in src/prompts/transcribe.ts).
export function scanPageToBlocks(pageText: string, page: number): Block[] {
  const blocks: Block[] = [];
  for (const chunk of pageText.split(/\n\s*\n/)) {
    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ kind: "text", text: clean(paragraph.join(" ")), page });
      paragraph = [];
    };
    for (const raw of chunk.split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("# ")) {
        flush();
        if (clean(line.slice(2))) blocks.push({ kind: "heading", text: clean(line.slice(2)), page });
      } else if (line) {
        paragraph.push(line);
      }
    }
    flush();
  }
  return blocks;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function htmlText(html: string): string {
  return clean(
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
        if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(parseInt(code.slice(2), 16));
        if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
        return ENTITIES[code.toLowerCase()] ?? match;
      }),
  );
}

// A Word file converted to simple HTML (by mammoth): real headings, paragraphs, list items
// and table cells, in order.
export function docxHtmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  for (const match of html.matchAll(/<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = htmlText(match[2]);
    if (!text) continue;
    blocks.push({ kind: match[1].toLowerCase().startsWith("h") ? "heading" : "text", text, page: null });
  }
  return blocks;
}
