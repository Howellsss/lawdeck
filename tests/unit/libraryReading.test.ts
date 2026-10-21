import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { costUsd } from "@/server/ai/costs";
import { parseTranscript } from "@/server/ai/transcribe";
import { docxHtmlToBlocks, isHeadingLine, pdfPageToBlocks, scanPageToBlocks, type Block } from "@/server/library/blocks";
import { needsScan, readDocxBlocks, readPdfText } from "@/server/library/extract";
import { missingPages, nextBatch } from "@/server/library/reading";
import { PASSAGE_MAX_WORDS, PASSAGE_MIN_WORDS, readingQuality, splitIntoPassages } from "@/server/library/split";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)));
const words = (count: number, word = "word") => Array.from({ length: count }, () => word).join(" ");
const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe("headings in PDF text", () => {
  it("recognises named, numbered and capital-letter headings", () => {
    expect(isHeadingLine("Order 5 Rule 1")).toBe(true);
    expect(isHeadingLine("PART TWO: CARRYING ON")).toBe(true);
    expect(isHeadingLine("2.3 Service out of the area")).toBe(true);
    expect(isHeadingLine("Chapter IV")).toBe(true);
  });

  it("does not treat ordinary sentences as headings", () => {
    expect(isHeadingLine("1. The first party must file the form within fourteen days of service.")).toBe(false);
    expect(isHeadingLine("This is a made-up sample paragraph used only to test reading.")).toBe(false);
    expect(isHeadingLine("NOTE,")).toBe(false);
    expect(isHeadingLine("12")).toBe(false);
  });
});

describe("turning page text into headings and paragraphs", () => {
  it("joins lines into paragraphs and keeps headings apart, with the page number", () => {
    const blocks = pdfPageToBlocks("PART ONE\nFirst line of text\ncarries on here.\n\nA new para-\ngraph starts.", 4);
    expect(blocks).toEqual([
      { kind: "heading", text: "PART ONE", page: 4 },
      { kind: "text", text: "First line of text carries on here.", page: 4 },
      { kind: "text", text: "A new paragraph starts.", page: 4 },
    ]);
  });

  it("reads Claude's marked headings and blank-line paragraphs from scanned pages", () => {
    const blocks = scanPageToBlocks("# Topic one\nSome text\nmore text.\n\nSecond paragraph.\n#not a heading", 2);
    expect(blocks).toEqual([
      { kind: "heading", text: "Topic one", page: 2 },
      { kind: "text", text: "Some text more text.", page: 2 },
      { kind: "text", text: "Second paragraph. #not a heading", page: 2 },
    ]);
  });

  it("reads Word headings, paragraphs, list items and table cells, decoding special characters", () => {
    const blocks = docxHtmlToBlocks(
      "<h1>Title &amp; scope</h1><p>Text <strong>bold</strong> here.</p><ul><li>Item</li></ul><table><tr><td><p>Cell</p></td></tr></table><p></p>",
    );
    expect(blocks).toEqual([
      { kind: "heading", text: "Title & scope", page: null },
      { kind: "text", text: "Text bold here.", page: null },
      { kind: "text", text: "Item", page: null },
      { kind: "text", text: "Cell", page: null },
    ]);
  });
});

describe("reading real files", () => {
  it("reads a PDF page by page and spots pages that need scanning", async () => {
    const pdf = await readPdfText(fixture("sample-text.pdf"));
    expect(pdf.pageCount).toBe(3);
    expect(pdf.pages[0]).toContain("PART ONE: GETTING STARTED");
    expect(pdf.pages[1]).toContain("Third topic");
    expect(pdf.pages.map(needsScan)).toEqual([false, false, true]);
  });

  it("reads a Word file with its real headings", async () => {
    const blocks = await readDocxBlocks(fixture("sample.docx"));
    expect(blocks[0]).toEqual({ kind: "heading", text: "Part One: Getting started", page: null });
    expect(blocks.filter((block) => block.kind === "heading").map((block) => block.text)).toEqual([
      "Part One: Getting started",
      "First topic",
    ]);
    expect(blocks.map((block) => block.text)).toContain("Cell B");
  });
});

describe("splitting into passages", () => {
  const section = (heading: string, paragraphs: number[], page: number): Block[] => [
    { kind: "heading", text: heading, page },
    ...paragraphs.map((count): Block => ({ kind: "text", text: words(count), page })),
  ];

  it("keeps passages between the minimum and maximum length", () => {
    const blocks = [...section("One", [200, 200, 200], 1), ...section("Two", [250, 250], 2), ...section("Three", [400], 3)];
    const passages = splitIntoPassages(blocks);
    for (const passage of passages) {
      expect(countWords(passage.text)).toBeLessThanOrEqual(PASSAGE_MAX_WORDS);
      expect(countWords(passage.text)).toBeGreaterThanOrEqual(PASSAGE_MIN_WORDS);
    }
    expect(passages.map((passage) => passage.heading)).toEqual(["One", "Two", "Three"]);
  });

  it("keeps a heading with the text that follows it, never alone at the end", () => {
    const passages = splitIntoPassages([...section("One", [700], 1), ...section("Two", [200], 2)]);
    expect(passages).toHaveLength(2);
    expect(passages[1].text.startsWith("Two\n\n")).toBe(true);
    expect(passages[0].text.endsWith("Two")).toBe(false);
  });

  it("joins short sections together and records the page range", () => {
    const passages = splitIntoPassages([...section("1. First", [60], 1), ...section("2. Second", [60], 2)]);
    expect(passages).toHaveLength(1);
    expect(passages[0]).toMatchObject({ heading: "1. First", pageFrom: 1, pageTo: 2 });
    expect(passages[0].text).toContain("2. Second");
  });

  it("carries the heading over when a long section is split", () => {
    const passages = splitIntoPassages(section("Long section", [500, 500, 500], 7));
    expect(passages).toHaveLength(3);
    expect(passages.every((passage) => passage.heading === "Long section")).toBe(true);
  });

  it("breaks a single very long paragraph at sentence ends", () => {
    const sentence = `${words(99)} end.`;
    const passages = splitIntoPassages([{ kind: "text", text: Array.from({ length: 20 }, () => sentence).join(" "), page: null }]);
    expect(passages.length).toBe(3);
    for (const passage of passages) {
      expect(countWords(passage.text)).toBeLessThanOrEqual(PASSAGE_MAX_WORDS);
      expect(passage.text.endsWith("end.")).toBe(true);
      expect(passage.pageFrom).toBeNull();
    }
  });

  it("keeps passages inside the database's size limit even with no spaces", () => {
    const passages = splitIntoPassages([{ kind: "text", text: "x".repeat(50_000), page: 1 }]);
    expect(passages.every((passage) => passage.text.length <= 20_000)).toBe(true);
  });

  it("returns nothing for a file with no text", () => {
    expect(splitIntoPassages([])).toEqual([]);
    expect(splitIntoPassages([{ kind: "heading", text: "Only a heading", page: 1 }])).toEqual([]);
  });
});

describe("reading quality", () => {
  it("is the share of pages with readable text", () => {
    expect(readingQuality([words(30), words(30), "", words(30)])).toBe(0.75);
    expect(readingQuality([`${words(20)} [unreadable] [unreadable] [unreadable]`])).toBe(0);
    expect(readingQuality([])).toBe(0);
  });
});

describe("Claude's transcript", () => {
  it("is split by page markers, keeping only the pages asked for", () => {
    const pages = parseTranscript("=== Page 4 ===\nFour\n\n=== Page 5 ===\n\n=== Page 9 ===\nNine", 4, 6);
    expect([...pages.entries()]).toEqual([
      [4, "Four"],
      [5, ""],
    ]);
  });

  it("takes a reply without markers as the single page asked for", () => {
    expect([...parseTranscript("Just text", 1, 1).entries()]).toEqual([[1, "Just text"]]);
    expect(parseTranscript("Just text", 1, 3).size).toBe(0);
  });
});

describe("reading scans in batches", () => {
  it("finds pages still to read", () => {
    expect(missingPages(5, new Set([1, 3]))).toEqual([2, 4, 5]);
  });

  it("takes up to three pages that follow on from each other", () => {
    expect(nextBatch([2, 3, 4, 5])).toEqual([2, 3, 4]);
    expect(nextBatch([2, 4, 5])).toEqual([2]);
    expect(nextBatch([])).toEqual([]);
  });
});

describe("AI cost", () => {
  it("counts cache writes and reads at their own prices", () => {
    expect(costUsd("claude-haiku-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6);
    expect(
      costUsd("claude-haiku-5-5", {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 1_000_000,
        cache_read_input_tokens: 1_000_000,
      }),
    ).toBeCloseTo(0.135);
    expect(costUsd("unknown-model", { input_tokens: 1, output_tokens: 1 })).toBeNull();
  });
});
