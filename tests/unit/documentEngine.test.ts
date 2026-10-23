import JSZip from "jszip"; // comes with the docx library; used here only to look inside Word files
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE,
  documentContentSchema,
  templateSpecSchema,
  type TemplateSpec,
} from "@/schemas/drafting";
import {
  checkDocument,
  definedTermIssues,
  impossibleDatesInText,
  partyNameIssues,
} from "@/server/documents/checks";
import { documentToDocx } from "@/server/documents/docx";
import {
  buildDocument,
  dateInWords,
  factText,
  plainText,
} from "@/server/documents/render";

// A made-up template for the tests only (no legal wording).
const spec: TemplateSpec = templateSpecSchema.parse({
  parts: [
    {
      id: "heading",
      heading: "WOMBAT NOTICE",
      kind: "fixed",
      align: "center",
      text: "IN THE QUOKKA COURT\nBETWEEN {{claimant}} AND {{defendant}}",
      required: true,
      why: "Names the parties.",
    },
    {
      id: "date",
      kind: "fixed",
      text: "Dated {{noticeDate}}.",
      required: true,
      why: "Dates the notice.",
    },
    {
      id: "facts",
      heading: "Facts",
      kind: "narrative",
      instruction: "State the facts.",
      maxWords: 200,
      required: true,
      why: "The story.",
    },
    {
      id: "extra",
      kind: "narrative",
      instruction: "Anything else.",
      maxWords: 50,
      required: false,
      why: "Optional.",
    },
    {
      id: "lagosOnly",
      kind: "fixed",
      text: "Lagos wording.",
      required: true,
      forums: ["quokka-court"],
      why: "Only in one court.",
    },
    {
      id: "signature",
      kind: "signature",
      required: true,
      why: "Counsel signs.",
    },
  ],
  fields: [
    {
      id: "claimant",
      label: "Claimant",
      type: "party",
      required: true,
      question: "Who sues?",
      placeholder: "CLAIMANT’S NAME",
    },
    {
      id: "defendant",
      label: "Defendant",
      type: "party",
      required: true,
      question: "Who is sued?",
      placeholder: "DEFENDANT’S NAME",
      repeatable: true,
    },
    {
      id: "noticeDate",
      label: "Date of notice",
      type: "date",
      required: true,
      question: "When?",
      placeholder: "DATE",
    },
  ],
  definedTerms: ["the Burrow"],
  changeLog: [{ date: "2026-10-23", note: "Test." }],
});
const content = (over: object = {}) => documentContentSchema.parse(over);
const build = (
  c = content(),
  forumSlug: string | null = null,
  profile = DEFAULT_PROFILE,
) =>
  buildDocument({
    title: "Wombat notice",
    spec,
    profile,
    forumSlug,
    content: c,
  });

describe("building a document", () => {
  it("fills the facts it has and shows placeholders for the rest, inventing nothing", () => {
    const model = build(content({ fields: { claimant: "Adaeze Okafor" } }));
    const heading = model.blocks[0];
    expect(heading.align).toBe("center");
    expect(heading.paragraphs[1].runs).toEqual([
      { text: "BETWEEN Adaeze Okafor AND " },
      { text: "[DEFENDANT’S NAME]", placeholder: true, field: "defendant" },
    ]);
    expect(
      model.blocks.find((b) => b.partId === "facts")?.paragraphs[0].runs[0],
    ).toEqual({ text: "[FACTS TO BE ADDED]", placeholder: true });
  });

  it("joins several parties and writes dates in words", () => {
    const model = build(
      content({
        fields: {
          defendant: ["Bisi Ade", "Chidi Eze", "Dayo Ola"],
          noticeDate: "2026-02-03",
        },
      }),
    );
    expect(plainText(model)).toContain("AND Bisi Ade, Chidi Eze and Dayo Ola");
    expect(plainText(model)).toContain("Dated 3 February 2026.");
    expect(dateInWords("2026-02-30")).toBe("2026-02-30");
  });

  it("leaves out empty optional parts and parts meant for another court", () => {
    expect(build().blocks.map((b) => b.partId)).toEqual([
      "heading",
      "date",
      "facts",
      "signature",
    ]);
    expect(
      build(
        content({ narrative: { extra: "More." } }),
        "quokka-court",
      ).blocks.map((b) => b.partId),
    ).toEqual(["heading", "date", "facts", "extra", "lagosOnly", "signature"]);
  });

  it("uses the student's own rewrite of a part, and adds the right signing space", () => {
    const model = build(
      content({ edits: { heading: "MY OWN HEADING" } }),
      null,
      { ...DEFAULT_PROFILE, signatureBlock: "both" },
    );
    expect(model.blocks[0].paragraphs[0].runs[0].text).toBe("MY OWN HEADING");
    expect(model.blocks.at(-1)!.paragraphs.map((p) => p.runs[0].text)).toEqual([
      "……………………………………",
      "Legal practitioner",
      "……………………………………",
      "Signature",
    ]);
  });

  it("shows nothing for a missing fact", () => {
    expect(factText(spec.fields[1], ["", " "])).toBeNull();
  });
});

describe("automatic checks", () => {
  it("flags unwritten required parts and missing facts", () => {
    const messages = checkDocument(spec, content(), build()).map(
      (i) => i.message,
    );
    expect(messages).toContain("“Facts” has not been written yet.");
    expect(messages).toContain(
      "Missing: Claimant (shown as [CLAIMANT’S NAME]).",
    );
  });

  it("flags dates that cannot exist, in facts and in the text", () => {
    const c = content({
      fields: { noticeDate: "2026-02-30" },
      narrative: {
        facts: "On the 31st day of April, 2026 and on 29 February 2028.",
      },
    });
    const dates = checkDocument(spec, c, build(c))
      .filter((i) => i.kind === "date")
      .map((i) => i.message);
    expect(dates).toEqual([
      "Date of notice: “2026-02-30” is not a real date.",
      "“31st day of April, 2026” is not a real date.",
    ]);
    expect(impossibleDatesInText("29 February 2027, 28 February 2027")).toEqual(
      ["29 February 2027"],
    );
  });

  it("flags a party written two ways, but not titles, the surname alone or ordinary words", () => {
    const c = content({ fields: { claimant: "Adaeze Okafor" } });
    const text =
      "Mrs Okafor met Chief Adaeze Okafor. Then Okafor said Okafor paid. Later Ada Okafor left.";
    expect(partyNameIssues(spec, c, text).map((i) => i.message)).toEqual([
      "“Ada Okafor” does not match the party “Adaeze Okafor”. Check the name is the same everywhere.",
    ]);
  });

  it("flags a defined term used only once", () => {
    expect(
      definedTermIssues(spec, 'The house ("the Burrow") is old.'),
    ).toHaveLength(1);
    expect(
      definedTermIssues(
        spec,
        'The house ("the Burrow") is old. The Burrow leaks.',
      ),
    ).toEqual([]);
    expect(definedTermIssues(spec, "No term here.")).toEqual([]);
  });

  it("passes a complete, consistent document", () => {
    const c = content({
      fields: {
        claimant: "Adaeze Okafor",
        defendant: ["Bisi Ade"],
        noticeDate: "2026-10-23",
      },
      narrative: {
        facts:
          'Adaeze Okafor rented the house ("the Burrow") to Bisi Ade. The Burrow was damaged.',
      },
    });
    expect(checkDocument(spec, c, build(c))).toEqual([]);
  });
});

describe("the Word file", () => {
  it("holds the same words as the preview, in the court's page size, font and margins, with marked placeholders", async () => {
    const model = build(
      content({
        fields: { claimant: "Adaeze Okafor" },
        narrative: { facts: "First line.\nSecond line." },
      }),
    );
    const zip = await JSZip.loadAsync(await documentToDocx(model));
    const xml = await zip.file("word/document.xml")!.async("string");
    const words = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join("");
    for (const paragraph of model.blocks.flatMap((b) => [
      b.heading ?? "",
      ...b.paragraphs.map((p) => p.runs.map((r) => r.text).join("")),
    ]))
      expect(words).toContain(paragraph.replace(/&/g, "&amp;"));
    expect(xml).toMatch(/<w:pgSz w:w="11906" w:h="16838"/); // A4
    expect(xml).toMatch(
      /<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/,
    ); // 1 inch
    expect(xml).toContain('w:val="dash"'); // placeholder underline
    expect(xml).toContain('w:line="360"'); // 1.5 spacing
    const styles = await zip.file("word/styles.xml")!.async("string");
    expect(styles).toContain('w:ascii="Times New Roman"');
    expect(styles).toContain('<w:sz w:val="24"/>'); // 12 pt
    expect(
      Object.keys(zip.files).some((name) => name.startsWith("word/footer")),
    ).toBe(true); // page numbers
  });

  it("starts a new page after a cover page", async () => {
    const zip = await JSZip.loadAsync(
      await documentToDocx(
        build(content(), null, {
          ...DEFAULT_PROFILE,
          coverPage: true,
          pageNumbers: "none",
        }),
      ),
    );
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml.match(/<w:pageBreakBefore\/>/g)).toHaveLength(1);
    expect(
      Object.keys(zip.files).some((name) => name.startsWith("word/footer")),
    ).toBe(false);
  });
});

describe("numbered lists", () => {
  const listSpec = templateSpecSchema.parse({
    parts: [{ id: "list", kind: "fixed", text: "WITNESSES\n#. {{witness}} of {{witnessAddress}}", required: true, why: "Lists the witnesses." }],
    fields: [
      { id: "witness", label: "Witnesses", type: "party", required: true, question: "Who?", placeholder: "WITNESS", repeatable: true },
      { id: "witnessAddress", label: "Their addresses", type: "address", required: false, question: "Where?", placeholder: "WITNESS’S ADDRESS", repeatable: true },
    ],
    changeLog: [{ date: "2026-10-23", note: "Test." }],
  });
  const draw = (fields: Record<string, string[]>) =>
    plainText(
      buildDocument({ title: "List", spec: listSpec, profile: DEFAULT_PROFILE, forumSlug: null, content: documentContentSchema.parse({ fields }) }),
    );

  it("repeats a '#.' line once for each answer, numbered, pairing the answers in order", () => {
    expect(draw({ witness: ["Ada Wombat", "Bayo Quokka"], witnessAddress: ["1 Numbat Road"] })).toBe(
      "WITNESSES\n1. Ada Wombat of 1 Numbat Road\n2. Bayo Quokka of [WITNESS’S ADDRESS]",
    );
  });

  it("shows one numbered placeholder line when nothing is given", () => {
    expect(draw({})).toBe("WITNESSES\n1. [WITNESS] of [WITNESS’S ADDRESS]");
  });
});
