import "server-only";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  TextRun,
  UnderlineType,
  type IParagraphOptions,
} from "docx";
import type { ForumProfile } from "@/schemas/drafting";
import type { Block, DocModel, Run } from "./render";
import { LAYOUT, PAPER_MM } from "./layout";

// Writes the Word file from the same document model as the on-screen pages (rule H-04, PRD
// EX-01). Page size, font, spacing, margins and page numbers follow the court's profile (DR-07).

// Placeholder look in Word, matching the on-screen .placeholder: bold, grey box, dashed line.
// Word needs literal colours; these are the light-mode "line" and "ink" tokens.
const PLACEHOLDER_FILL = "E7E5E0";
const PLACEHOLDER_LINE = "141414";

// Millimetres to Word's twentieths of a point, rounded to the nearest (A4 is exactly 11906 × 16838).
const twips = (mm: number) => Math.round((mm * 1440) / 25.4);

const ALIGN = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
} as const;

export async function documentToDocx(model: DocModel): Promise<Buffer> {
  const { profile } = model;
  const paper = PAPER_MM[profile.paper];
  const doc = new Document({
    creator: "Lawdeck",
    title: model.title.slice(0, 200),
    styles: {
      default: {
        document: {
          run: { font: profile.font, size: Math.round(profile.fontSizePt * 2) },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: twips(paper.width), height: twips(paper.height) },
            margin: {
              top: twips(profile.marginsMm.top),
              right: twips(profile.marginsMm.right),
              bottom: twips(profile.marginsMm.bottom),
              left: twips(profile.marginsMm.left),
            },
          },
        },
        ...pageNumbers(profile),
        // A cover page: the first part sits alone on page 1, so the second starts a new page.
        children: model.blocks.flatMap((block, index) =>
          blockParagraphs(block, profile, index === 1 && profile.coverPage),
        ),
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function blockParagraphs(
  block: Block,
  profile: ForumProfile,
  newPage: boolean,
): Paragraph[] {
  const spacing = {
    line: Math.round(240 * profile.lineSpacing),
    lineRule: LineRuleType.AUTO,
    after: LAYOUT.paragraphAfterPt * 20,
  };
  const options: IParagraphOptions[] = [];
  if (block.heading)
    options.push({
      alignment: AlignmentType.CENTER,
      spacing: { ...spacing, before: LAYOUT.headingBeforePt * 20 },
      keepNext: true,
      children: [new TextRun({ text: block.heading, bold: true })],
    });
  for (const paragraph of block.paragraphs)
    options.push({
      alignment: ALIGN[block.align],
      spacing,
      children: paragraph.runs.map(toRun),
    });
  return options.map(
    (option, index) =>
      new Paragraph(
        index === 0 && newPage ? { ...option, pageBreakBefore: true } : option,
      ),
  );
}

function toRun(run: Run): TextRun {
  if (!run.placeholder) return new TextRun({ text: run.text });
  return new TextRun({
    text: run.text,
    bold: true,
    shading: { type: ShadingType.CLEAR, fill: PLACEHOLDER_FILL, color: "auto" },
    underline: { type: UnderlineType.DASH, color: PLACEHOLDER_LINE },
  });
}

function pageNumbers(profile: ForumProfile): {
  footers?: { default: Footer };
  headers?: { default: Header };
} {
  if (profile.pageNumbers === "none") return {};
  const paragraph = new Paragraph({
    alignment:
      profile.pageNumbers === "bottom-centre"
        ? AlignmentType.CENTER
        : AlignmentType.RIGHT,
    children: [new TextRun({ children: [PageNumber.CURRENT] })],
  });
  return profile.pageNumbers === "top-right"
    ? { headers: { default: new Header({ children: [paragraph] }) } }
    : { footers: { default: new Footer({ children: [paragraph] }) } };
}
