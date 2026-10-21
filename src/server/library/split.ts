import "server-only";
import type { Block } from "./blocks";

// System Design §6: passages of roughly 300–800 words, keeping headings and section numbers
// with their text, with page references.
export const PASSAGE_MIN_WORDS = 300;
export const PASSAGE_MAX_WORDS = 800;
// The database allows 20,000 characters; this leaves room for unusually long words.
const PASSAGE_MAX_CHARS = 12_000;
const HEADING_MAX_CHARS = 500;

export type Passage = { heading: string | null; text: string; pageFrom: number | null; pageTo: number | null };

type Unit = { kind: Block["kind"]; text: string; words: number; page: number | null };

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// Breaks a paragraph longer than a passage at sentence ends (or, failing that, between words).
function pieces(text: string): string[] {
  if (countWords(text) <= PASSAGE_MAX_WORDS && text.length <= PASSAGE_MAX_CHARS) return [text];
  const sentences = text.split(/(?<=[.;:?!])\s+/);
  const out: string[] = [];
  let current: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    for (const part of wordChunks(sentence)) {
      const partWords = countWords(part);
      if (current.length && (words + partWords > PASSAGE_MAX_WORDS || [...current, part].join(" ").length > PASSAGE_MAX_CHARS)) {
        out.push(current.join(" "));
        current = [];
        words = 0;
      }
      current.push(part);
      words += partWords;
    }
  }
  if (current.length) out.push(current.join(" "));
  return out;
}

// A single "sentence" that is itself too long is cut between words.
function wordChunks(sentence: string): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    if (current.length >= PASSAGE_MAX_WORDS || [...current, word].join(" ").length > PASSAGE_MAX_CHARS) {
      out.push(current.join(" "));
      current = [];
    }
    current.push(word.slice(0, PASSAGE_MAX_CHARS));
  }
  if (current.length) out.push(current.join(" "));
  return out;
}

type Draft = { heading: string | null; units: Unit[]; words: number; hasText: boolean };

function finish(draft: Draft): Passage {
  const pages = draft.units.map((unit) => unit.page).filter((page): page is number => page !== null);
  return {
    heading: draft.heading ? draft.heading.slice(0, HEADING_MAX_CHARS) : null,
    text: draft.units.map((unit) => unit.text).join("\n\n"),
    pageFrom: pages.length ? Math.min(...pages) : null,
    pageTo: pages.length ? Math.max(...pages) : null,
  };
}

// Splits a file's headings and paragraphs into passages, in reading order.
// A heading always travels with the text after it; a new heading starts a new passage once
// the current one has at least the minimum length; a passage never passes the maximum.
export function splitIntoPassages(blocks: Block[]): Passage[] {
  const units: Unit[] = blocks.flatMap((block) =>
    block.kind === "heading"
      ? [{ kind: block.kind, text: block.text, words: countWords(block.text), page: block.page }]
      : pieces(block.text).map((text) => ({ kind: block.kind, text, words: countWords(text), page: block.page })),
  );

  const drafts: Draft[] = [];
  let lastHeading: string | null = null;
  let current: Draft = { heading: null, units: [], words: 0, hasText: false };
  const chars = (draft: Draft, unit: Unit) =>
    draft.units.reduce((sum, u) => sum + u.text.length + 2, 0) + unit.text.length;
  const startNew = (heading: string | null) => {
    drafts.push(current);
    current = { heading, units: [], words: 0, hasText: false };
  };

  for (const unit of units) {
    if (unit.kind === "heading") {
      // Close the passage at a new heading once it is long enough.
      if (current.hasText && (current.words >= PASSAGE_MIN_WORDS || current.words + unit.words > PASSAGE_MAX_WORDS)) {
        startNew(null);
      }
      lastHeading = unit.text;
      current.heading ??= unit.text;
    } else if (current.hasText && (current.words + unit.words > PASSAGE_MAX_WORDS || chars(current, unit) > PASSAGE_MAX_CHARS)) {
      // Too long: carry the section's heading over to the next passage.
      startNew(lastHeading);
    }
    current.units.push(unit);
    current.words += unit.words;
    if (unit.kind === "text") current.hasText = true;
  }
  drafts.push(current);

  // Headings with no text after them join the passage before; a very short last passage
  // joins the one before it if they fit together.
  const merged: Draft[] = [];
  for (const draft of drafts) {
    if (draft.units.length === 0) continue;
    const previous = merged.at(-1);
    const fits =
      previous !== undefined &&
      previous.words + draft.words <= PASSAGE_MAX_WORDS &&
      [...previous.units, ...draft.units].reduce((sum, u) => sum + u.text.length + 2, 0) <= PASSAGE_MAX_CHARS;
    if (previous && (!draft.hasText || (draft === drafts.at(-1) && draft.words < PASSAGE_MIN_WORDS / 2 && fits))) {
      previous.units.push(...draft.units);
      previous.words += draft.words;
      previous.hasText ||= draft.hasText;
      continue;
    }
    merged.push(draft);
  }
  return merged.filter((draft) => draft.hasText).map(finish);
}

// Share of pages with readable text: at least 20 words, and little marked as unreadable.
export function readingQuality(pageTexts: string[]): number {
  if (pageTexts.length === 0) return 0;
  const readable = pageTexts.filter((text) => {
    const words = countWords(text);
    const unreadable = (text.match(/\[unreadable\]/gi) ?? []).length;
    return words >= 20 && unreadable / words < 0.1;
  }).length;
  return Math.round((readable / pageTexts.length) * 1000) / 1000;
}
