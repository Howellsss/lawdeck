import {
  fieldTokens,
  type DocumentContent,
  type TemplateSpec,
} from "@/schemas/drafting";
import { isRealDate, plainText, type DocModel } from "./render";

// Automatic checks before a document is shown (DR-06): missing required parts and facts,
// party names written two ways, dates that cannot exist, and defined terms never used. They
// only flag; the student decides what to change.

export type CheckIssue = {
  kind:
    | "missing_part"
    | "missing_fact"
    | "party_name"
    | "date"
    | "defined_term";
  message: string;
  partId?: string;
};

const TITLES = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "chief",
  "alhaji",
  "alhaja",
  "prof",
  "professor",
  "barr",
  "engr",
  "sir",
  "lady",
  "hon",
  "rev",
  "pastor",
  "otunba",
  "oba",
  "high",
]);
// Ordinary words that can start a sentence before a surname ("Then Okafor said…").
const COMMON = new Set(
  "the a an and but or so then that this when while after before since because therefore thereafter also both between against dear per by for to of at as with from on in upon said whereas whereby hereby where who whom whose if unless until once only even yet however further accordingly".split(
    " ",
  ),
);
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function checkDocument(
  spec: TemplateSpec,
  content: DocumentContent,
  model: DocModel,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const shown = new Set(model.blocks.map((b) => b.partId));

  for (const block of model.blocks) {
    const part = spec.parts.find((p) => p.id === block.partId);
    const text = block.paragraphs
      .flatMap((p) => p.runs)
      .filter((r) => !r.placeholder)
      .map((r) => r.text)
      .join("")
      .trim();
    if (part?.required && part.kind === "narrative" && !text)
      issues.push({
        kind: "missing_part",
        partId: part.id,
        message: `“${part.heading ?? part.id}” has not been written yet.`,
      });
  }

  for (const field of spec.fields) {
    if (!field.required || !usedIn(spec, field.id, shown)) continue;
    const value = content.fields[field.id];
    const empty = Array.isArray(value)
      ? value.every((v) => !v.trim())
      : !value?.trim();
    if (empty)
      issues.push({
        kind: "missing_fact",
        message: `Missing: ${field.label} (shown as [${field.placeholder}]).`,
      });
  }

  for (const field of spec.fields.filter((f) => f.type === "date")) {
    const values = [content.fields[field.id] ?? []]
      .flat()
      .filter((v) => v.trim());
    for (const value of values) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
      if (!m || !isRealDate(Number(m[1]), Number(m[2]), Number(m[3])))
        issues.push({
          kind: "date",
          message: `${field.label}: “${value}” is not a real date.`,
        });
    }
  }

  const text = plainText(model);
  for (const bad of impossibleDatesInText(text))
    issues.push({ kind: "date", message: `“${bad}” is not a real date.` });
  issues.push(...partyNameIssues(spec, content, text));
  issues.push(...definedTermIssues(spec, text));
  return issues;
}

// Is the field used by a part that appears in this document (or by any narrative part)?
function usedIn(
  spec: TemplateSpec,
  fieldId: string,
  shown: Set<string>,
): boolean {
  return spec.parts.some(
    (p) =>
      shown.has(p.id) &&
      (p.kind === "narrative" || fieldTokens(p.text ?? "").includes(fieldId)),
  );
}

// Dates written in words, such as "31 February 2026" or "31st day of April, 2026".
export function impossibleDatesInText(text: string): string[] {
  const found: string[] = [];
  const pattern = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+day\\s+of)?\\s+(${MONTHS.join("|")}),?\\s+(\\d{4})\\b`,
    "gi",
  );
  for (const m of text.matchAll(pattern)) {
    if (
      !isRealDate(
        Number(m[3]),
        MONTHS.indexOf(m[2].toLowerCase()) + 1,
        Number(m[1]),
      )
    )
      found.push(m[0]);
  }
  return [...new Set(found)];
}

// A party written two ways, e.g. "Adaeze Okafor" in the heading and "Ada Okafor" in the facts.
// Titles (Mr, Chief, …) and the surname alone are fine.
export function partyNameIssues(
  spec: TemplateSpec,
  content: DocumentContent,
  text: string,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const names = spec.fields
    .filter((f) => f.type === "party")
    .flatMap((f) => [content.fields[f.id] ?? []].flat())
    .map((n) => n.trim())
    .filter((n) => n.split(/\s+/).length >= 2);
  const seen = new Set<string>();
  for (const name of names) {
    const words = name.split(/\s+/);
    const surname = words.at(-1)!;
    if (surname.length < 3 || !/^[A-Z]/.test(surname)) continue;
    const known = new Set(
      words.map((w) => w.toLowerCase().replace(/[^a-z]/g, "")),
    );
    const pattern = new RegExp(
      `((?:[A-Z][a-zA-Z.'’-]*\\s+){1,3})${escape(surname)}\\b`,
      "g",
    );
    for (const m of text.matchAll(pattern)) {
      const before = m[1]
        .trim()
        .split(/\s+/)
        .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""));
      const strangers = before.filter(
        (w) => w && !known.has(w) && !TITLES.has(w) && !COMMON.has(w),
      );
      // Only the word right before the surname matters: "Mr Okafor" and "Adaeze Okafor" are fine,
      // "Ada Okafor" is not.
      const nearest = before.at(-1) ?? "";
      if (strangers.includes(nearest)) {
        const written = `${m[1].trim().split(/\s+/).at(-1)} ${surname}`;
        if (!seen.has(written)) {
          seen.add(written);
          issues.push({
            kind: "party_name",
            message: `“${written}” does not match the party “${name}”. Check the name is the same everywhere.`,
          });
        }
      }
    }
  }
  return issues;
}

// A defined term (e.g. "the Property") that appears at most once was defined but never used.
export function definedTermIssues(
  spec: TemplateSpec,
  text: string,
): CheckIssue[] {
  return spec.definedTerms
    .filter(
      (term) =>
        (text.match(new RegExp(`\\b${escape(term)}\\b`, "gi")) ?? []).length ===
        1,
    )
    .map((term) => ({
      kind: "defined_term" as const,
      message: `“${term}” is defined but never used again.`,
    }));
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
