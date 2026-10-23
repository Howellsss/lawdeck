import "server-only";
import { Document, Footer, HeadingLevel, LevelFormat, Packer, PageNumber, Paragraph, TextRun, AlignmentType } from "docx";
import type { Run, SheetBlock, StudySheet } from "./sheet";

// The Word file of a study sheet (PRD EX-03): plain A4, black and white, with headings and
// bullet lists Word recognises. Word needs literal colours: "muted" is the light-mode token.
const MUTED = "6B6B6B";
const FONT = "Arial";
// A4 with 20 mm margins, in twentieths of a point.
const A4 = { width: 11906, height: 16838 };
const MARGIN = 1134;

function textRuns(runs: Run[], muted = false): TextRun[] {
  return runs.map((run) => new TextRun({ text: run.text, bold: run.bold, color: muted ? MUTED : undefined }));
}

function paragraphs(block: SheetBlock): Paragraph[] {
  switch (block.kind) {
    case "heading":
      return [new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: block.text })] })];
    case "subheading":
      return [new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 }, children: [new TextRun({ text: block.text })] })];
    case "paragraph":
      return [new Paragraph({ spacing: { after: 120 }, children: textRuns(block.runs, block.muted) })];
    case "bullets":
      return block.items.map(
        (item) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: textRuns(item, block.muted) }),
      );
  }
}

export async function sheetToDocx(sheet: StudySheet): Promise<Buffer> {
  const doc = new Document({
    title: sheet.title,
    creator: "Lawdeck",
    styles: {
      default: {
        document: { run: { font: FONT, size: 22, color: "141414" } },
        heading1: { run: { font: FONT, size: 36, bold: true, color: "141414" } },
        heading2: { run: { font: FONT, size: 26, bold: true, color: "141414" } },
        heading3: { run: { font: FONT, size: 23, bold: true, color: "141414" } },
      },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: A4, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: ["Lawdeck · page ", PageNumber.CURRENT], color: MUTED, size: 18 })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 80 }, children: [new TextRun({ text: sheet.title })] }),
          new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: sheet.subtitle, color: MUTED })] }),
          ...sheet.blocks.flatMap(paragraphs),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
