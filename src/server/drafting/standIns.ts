import "server-only";
import type { DraftFact } from "@/prompts/draft";
import { fieldTokens, type DocumentContent, type TemplateField, type TemplateSpec } from "@/schemas/drafting";
import { redactPersonalData } from "@/server/learn/redact";

// Rule G-06: names, addresses and other personal details never reach the AI. Claude sees each
// fact as a stand-in such as {{claimantName}}; parties and addresses are marked "given" without
// their wording. Claude writes the stand-ins into the text, and the document engine puts the real
// facts (or a visible placeholder) in their place, so nothing personal is sent and nothing invented.

const HIDDEN_TYPES = new Set<TemplateField["type"]>(["party", "address"]);

// Every hidden detail (names and addresses) with its stand-in, longest first, so "Ada Okafor" is
// replaced before "Okafor".
export function hiddenDetails(spec: TemplateSpec, fields: DocumentContent["fields"]): { value: string; token: string }[] {
  return spec.fields
    .filter((field) => HIDDEN_TYPES.has(field.type))
    .flatMap((field) => valuesOf(fields[field.id]).map((value) => ({ value, token: `{{${field.id}}}` })))
    .filter((entry) => entry.value.length >= 2)
    .sort((a, b) => b.value.length - a.value.length);
}

export function factsForClaude(spec: TemplateSpec, fields: DocumentContent["fields"]): DraftFact[] {
  const hidden = hiddenDetails(spec, fields);

  return spec.fields.map((field) => {
    const values = valuesOf(fields[field.id]);
    if (values.length === 0) return { id: field.id, label: field.label, value: null, hidden: false };
    if (HIDDEN_TYPES.has(field.type)) return { id: field.id, label: field.label, value: null, hidden: true };
    const text = values.join("; ");
    return { id: field.id, label: field.label, value: redactPersonalData(maskDetails(text, hidden)), hidden: false };
  });
}

// A party's name or address typed inside another fact ("Okafor broke the gate") becomes its stand-in.
export function maskDetails(text: string, hidden: { value: string; token: string }[]): string {
  // Whole words only, so a short name ("Ade") is not found inside another word ("made").
  return hidden.reduce(
    (out, { value, token }) => out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`, "giu"), token),
    text,
  );
}

// Claude's text for one narrative part, made safe for the document: stand-ins that are not this
// template's fields are dropped (never shown as a fact), Markdown marks are removed, and the part
// is kept within its word limit, ending at a full sentence where possible.
export function cleanPart(text: string, spec: TemplateSpec, maxWords: number): string {
  const known = new Set(spec.fields.map((field) => field.id));
  const unknown = fieldTokens(text).filter((name) => !known.has(name));
  let out = text;
  for (const name of unknown) out = out.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "g"), "");
  out = out
    .replace(/^#{1,6}[ \t]+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return withinWords(out, maxWords);
}

export function withinWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  // Cut after the last full sentence that fits; if none does, cut at the limit.
  let count = 0;
  let cut = 0;
  for (const match of text.matchAll(/\S+/g)) {
    count += 1;
    if (count > maxWords) break;
    if (/[.!?;:]["”’)]?$/.test(match[0])) cut = match.index + match[0].length;
    if (count === maxWords && cut === 0) cut = match.index + match[0].length;
  }
  return text.slice(0, cut).trim();
}

function valuesOf(value: string | string[] | undefined): string[] {
  return (Array.isArray(value) ? value : [value ?? ""]).map((v) => v.trim()).filter(Boolean);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
