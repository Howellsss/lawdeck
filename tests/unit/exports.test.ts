import JSZip from "jszip"; // comes with the docx library; used here only to look inside Word files
import { describe, expect, it, vi } from "vitest";
import type { PracticeSetView } from "@/server/db/practice";
import type { ChatMessage } from "@/server/db/workspace";

vi.mock("server-only", () => ({}));
const { briefSheet, chatSheet, practiceSheet, textBlocks, SHEET_BLOCK_LIMIT } = await import("@/server/exports/sheet");
const { sheetToDocx } = await import("@/server/exports/docx");
const { exportFileName } = await import("@/server/exports/load");
const { exportRequestSchema } = await import("@/schemas/exports");

// Made-up content only.
const answer = (text: string, sources: ChatMessage["sources"] = []): ChatMessage => ({
  id: "a",
  role: "assistant",
  text,
  level: "exam",
  createdAt: "2026-10-23T10:00:00Z",
  sources,
});
const question = (text: string): ChatMessage => ({ ...answer(text), role: "user", level: null });

describe("answer formatting", () => {
  it("keeps headings, bullets and bold", () => {
    expect(textBlocks("## Rule\nA quokka writ **must** be served.\n- first\n- second")).toEqual([
      { kind: "subheading", text: "Rule" },
      { kind: "paragraph", runs: [{ text: "A quokka writ " }, { text: "must", bold: true }, { text: " be served." }] },
      { kind: "bullets", items: [[{ text: "first" }], [{ text: "second" }]] },
    ]);
  });
});

describe("chat notes", () => {
  it("lists each question, its answer, and source titles only", () => {
    const sheet = chatSheet({ title: "Quokka writs", courseName: "Civil Litigation" }, [
      question("What is a quokka writ?"),
      answer("A made-up writ [S1].", [
        { id: "s", label: 1, itemTitle: "Quokka notes", heading: "Writs", pages: "p. 3", origin: "upload" },
      ]),
    ], "exported today");
    expect(sheet.subtitle).toBe("Study notes · Civil Litigation · exported today");
    expect(sheet.blocks[0]).toEqual({ kind: "heading", text: "What is a quokka writ?" });
    expect(sheet.blocks.at(-1)).toEqual({
      kind: "bullets",
      muted: true,
      items: [[{ text: "[S1] Quokka notes · Writs · p. 3 (your uploads)" }]],
    });
  });

  it("is shortened when very long", () => {
    const messages = Array.from({ length: SHEET_BLOCK_LIMIT + 10 }, (_, i) => question(`Q${i}`));
    const sheet = chatSheet({ title: "Long", courseName: null }, messages, "now");
    expect(sheet.blocks).toHaveLength(SHEET_BLOCK_LIMIT + 1);
  });
});

describe("briefs", () => {
  it("shows sections, marks uncovered ones, and lists sources", () => {
    const sheet = briefSheet(
      {
        id: "b",
        kind: "case",
        name: "Quokka v Wombat",
        createdAt: "2026-10-23T10:00:00Z",
        sections: [
          { heading: "Facts", text: "The quokka sued.", covered: true },
          { heading: "Ratio", text: "Not covered in the library.", covered: false },
        ],
        sources: [{ label: 1, title: "Quokka casebook", heading: null, pages: null }],
      },
      "now",
    );
    expect(sheet.blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "heading", "paragraph", "heading", "bullets"]);
    expect(sheet.blocks[3]).toMatchObject({ muted: true });
  });
});

const set: PracticeSetView = {
  id: "p",
  title: "Quokka cards",
  kind: "flashcards",
  courseId: "c",
  createdAt: "2026-10-23T10:00:00Z",
  items: [
    { id: "1", question: "Known card", choices: null, chosen: null, known: true, marked: null, reveal: { answer: "Back one", correctChoice: null, sources: [] } },
    { id: "2", question: "New card", choices: null, chosen: null, known: null, marked: null, reveal: { answer: "Back two", correctChoice: null, sources: [] } },
  ],
};

describe("practice sets", () => {
  it("can leave out the cards already known", () => {
    const all = practiceSheet(set, "now");
    const notKnown = practiceSheet(set, "now", true);
    expect(all.blocks.filter((b) => b.kind === "heading")).toHaveLength(2);
    expect(notKnown.blocks[0]).toEqual({ kind: "heading", text: "1. New card" });
    expect(notKnown.subtitle).toContain("not known yet");
  });

  it("never shows an answer the student has not revealed yet", () => {
    const mcq: PracticeSetView = {
      ...set,
      kind: "mcq",
      items: [{ id: "3", question: "Which writ?", choices: ["Quokka", "Wombat"], chosen: null, known: null, marked: null, reveal: null }],
    };
    const text = JSON.stringify(practiceSheet(mcq, "now"));
    expect(text).toContain("Answer not shown yet");
    expect(text).not.toContain("Correct answer");
  });
});

describe("the Word file", () => {
  it("opens as a Word document with the sheet's text", async () => {
    const file = await sheetToDocx(practiceSheet(set, "now"));
    const zip = await JSZip.loadAsync(file);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Quokka cards");
    expect(xml).toContain("Back two");
    expect(xml).toContain('w:pgSz w:w="11906" w:h="16838"');
  });

  it("gets a safe file name", () => {
    expect(exportFileName('Quokka "v" Wombat/../x')).toBe("Quokka v Wombatx");
  });
});

describe("export requests", () => {
  it("accepts only known kinds and real ids", () => {
    expect(exportRequestSchema.safeParse({ kind: "chat", id: "aaaaaaaa-0000-4000-8000-000000000001" }).success).toBe(true);
    expect(exportRequestSchema.safeParse({ kind: "uploads", id: "aaaaaaaa-0000-4000-8000-000000000001" }).success).toBe(false);
    expect(exportRequestSchema.safeParse({ kind: "chat", id: "../../etc" }).success).toBe(false);
  });
});
