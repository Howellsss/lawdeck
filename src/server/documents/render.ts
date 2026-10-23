import {
  fieldTokens,
  type DocumentContent,
  type ForumProfile,
  type TemplateField,
  type TemplatePart,
  type TemplateSpec,
} from "@/schemas/drafting";

// The one document engine (rule H-04): template + court profile + the student's facts and text
// become a single document model. The on-screen pages and the Word file are both drawn from
// this model, so they always say the same thing. Missing facts become visible placeholders such
// as [DEFENDANT’S ADDRESS]; nothing is invented (DR-04).

// A placeholder run says which fact it stands for (field), so the preview can open that question.
export type Run = { text: string; placeholder?: boolean; field?: string };
export type Paragraph = { runs: Run[] };
export type Block = {
  partId: string;
  heading: string | null;
  kind: TemplatePart["kind"];
  align: TemplatePart["align"];
  paragraphs: Paragraph[];
  // Starts a new page (the part's own setting, or the part after a cover page).
  pageBreakBefore: boolean;
};
export type DocModel = {
  title: string;
  profile: ForumProfile;
  blocks: Block[];
};

export function buildDocument(input: {
  title: string;
  spec: TemplateSpec;
  profile: ForumProfile;
  forumSlug: string | null;
  content: DocumentContent;
}): DocModel {
  const { spec, content } = input;
  const fields = new Map(spec.fields.map((field) => [field.id, field]));
  const blocks: Block[] = [];
  for (const part of spec.parts) {
    if (
      part.forums &&
      (!input.forumSlug || !part.forums.includes(input.forumSlug))
    )
      continue;
    const source = sourceText(part, content);
    if (!part.required && part.kind === "narrative" && !source.trim()) continue;
    const paragraphs = source.trim()
      ? toParagraphs(source, fields, content)
      : part.kind === "signature"
        ? []
        : [
            {
              runs: [
                {
                  text: `[${(part.heading ?? part.id).toUpperCase()} TO BE ADDED]`,
                  placeholder: true,
                },
              ],
            },
          ];
    if (part.kind === "signature")
      paragraphs.push(...signatureLines(input.profile));
    blocks.push({
      partId: part.id,
      heading: part.heading ?? null,
      kind: part.kind,
      align: part.align,
      paragraphs,
      pageBreakBefore:
        part.pageBreakBefore ||
        (input.profile.coverPage && blocks.length === 1),
    });
  }
  return { title: input.title, profile: input.profile, blocks };
}

// A student's own rewrite of a part wins; otherwise the template's fixed wording or the
// narrative written for it. A signature part may have no wording of its own.
function sourceText(part: TemplatePart, content: DocumentContent): string {
  const edited = content.edits[part.id];
  if (edited !== undefined) return edited;
  if (part.kind === "narrative") return content.narrative[part.id] ?? "";
  return part.text ?? "";
}

// One paragraph per line; {{field}} becomes the fact, or its placeholder when missing.
// A line starting "#. " is a numbered list: it is repeated once for each answer of the
// several-answer facts it uses (a list of witnesses, a list of documents), numbered 1., 2., …
function toParagraphs(
  text: string,
  fields: Map<string, TemplateField>,
  content: DocumentContent,
): Paragraph[] {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .flatMap((line) =>
      listLines(line, fields, content).map(([text, facts]) => ({
        runs: fillLine(text, fields, facts),
      })),
    );
}

function listLines(
  line: string,
  fields: Map<string, TemplateField>,
  content: DocumentContent,
): [string, DocumentContent][] {
  if (!line.startsWith("#. ")) return [[line, content]];
  const listed = fieldTokens(line).filter((id) => fields.get(id)?.repeatable);
  const answers = (id: string) => {
    const value = content.fields[id];
    return (Array.isArray(value) ? value : [value ?? ""])
      .map((v) => v.trim())
      .filter(Boolean);
  };
  const count = Math.max(1, ...listed.map((id) => answers(id).length));
  return Array.from({ length: count }, (_, i) => [
    `${i + 1}${line.slice(1)}`,
    {
      ...content,
      fields: {
        ...content.fields,
        ...Object.fromEntries(listed.map((id) => [id, answers(id)[i] ?? ""])),
      },
    },
  ]);
}

function fillLine(
  line: string,
  fields: Map<string, TemplateField>,
  content: DocumentContent,
): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const match of line.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g)) {
    if (match.index > last) runs.push({ text: line.slice(last, match.index) });
    const field = fields.get(match[1]);
    const value = field ? factText(field, content.fields[field.id]) : null;
    runs.push(
      value
        ? { text: value }
        : {
            text: `[${field?.placeholder ?? match[1].toUpperCase()}]`,
            placeholder: true,
            ...(field ? { field: field.id } : {}),
          },
    );
    last = match.index + match[0].length;
  }
  if (last < line.length) runs.push({ text: line.slice(last) });
  return merge(runs);
}

// The fact as it reads in the document: lists joined ("A, B and C"), dates in words.
export function factText(
  field: TemplateField,
  value: string | string[] | undefined,
): string | null {
  const values = (Array.isArray(value) ? value : [value ?? ""])
    .map((v) => v.trim())
    .filter(Boolean);
  if (values.length === 0) return null;
  const shown = field.type === "date" ? values.map(dateInWords) : values;
  return shown.length === 1
    ? shown[0]
    : `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// "2026-10-23" → "23 October 2026". Anything else is left as typed (the checks flag it).
export function dateInWords(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (
    !match ||
    !isRealDate(Number(match[1]), Number(match[2]), Number(match[3]))
  )
    return value;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

export function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    year >= 1900 &&
    year <= 2200
  );
}

// Space to sign, by who signs in this court or registry.
function signatureLines(profile: ForumProfile): Paragraph[] {
  const line = "……………………………………";
  const who = {
    counsel: ["Legal practitioner"],
    party: ["Signature"],
    both: ["Legal practitioner", "Signature"],
  }[profile.signatureBlock];
  return who.flatMap((label) => [
    { runs: [{ text: line }] },
    { runs: [{ text: label }] },
  ]);
}

function merge(runs: Run[]): Run[] {
  return runs.reduce<Run[]>((all, run) => {
    const previous = all.at(-1);
    if (previous && !previous.placeholder && !run.placeholder)
      previous.text += run.text;
    else all.push({ ...run });
    return all;
  }, []);
}

// The document's plain text, for the checks and for counting words.
export function plainText(model: DocModel): string {
  return model.blocks
    .flatMap((block) => [
      block.heading ?? "",
      ...block.paragraphs.map((p) => p.runs.map((r) => r.text).join("")),
    ])
    .filter(Boolean)
    .join("\n");
}
