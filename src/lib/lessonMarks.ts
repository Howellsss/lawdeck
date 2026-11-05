import type { LessonMark, MarkType } from "@/schemas/lesson";

// Places a paragraph's highlights (docs/specs/remembrance.md). Claude names phrases; Lawdeck finds
// each one in the paragraph and keeps the page calm whatever the AI did:
// - a phrase that is not in the paragraph is dropped (a mark never changes the text);
// - marks never overlap, and a mark never covers most of a paragraph;
// - at most one mark per sentence and four per paragraph, keeping the most important kinds first.
export const MAX_MARKS_PER_PARAGRAPH = 4;
const PRIORITY: MarkType[] = ["exception", "case", "statute", "principle", "definition", "tip"];

export function placeMarks(
  text: string,
  wanted: { type: MarkType; phrase: string; authority?: string }[],
  authorityKeys: Set<string> = new Set(),
): LessonMark[] {
  const sentenceOf = sentenceStarts(text);
  const ranked = wanted
    .map((mark, order) => ({ ...mark, order }))
    .sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type) || a.order - b.order);
  const placed: (LessonMark & { sentence: number })[] = [];
  for (const mark of ranked) {
    if (placed.length >= MAX_MARKS_PER_PARAGRAPH) break;
    const phrase = mark.phrase.trim();
    if (phrase.length < 2 || phrase.length > text.length * 0.6) continue;
    const start = freeOccurrence(text, phrase, placed);
    if (start < 0) continue;
    const sentence = sentenceOf(start);
    if (placed.some((m) => m.sentence === sentence)) continue;
    const authority = mark.authority && authorityKeys.has(mark.authority) ? mark.authority : undefined;
    placed.push({ start, end: start + phrase.length, type: mark.type, ...(authority ? { authority } : {}), sentence });
  }
  return placed
    .sort((a, b) => a.start - b.start)
    .map((mark) => ({ start: mark.start, end: mark.end, type: mark.type, ...(mark.authority ? { authority: mark.authority } : {}) }));
}

// The first place the phrase appears that does not overlap a mark already placed.
function freeOccurrence(text: string, phrase: string, placed: LessonMark[]): number {
  let from = 0;
  while (from <= text.length) {
    const at = text.indexOf(phrase, from);
    if (at < 0) return -1;
    const end = at + phrase.length;
    if (!placed.some((m) => at < m.end && end > m.start)) return at;
    from = at + 1;
  }
  return -1;
}

// Which sentence a position falls in (sentences end with . ! or ? followed by a space).
function sentenceStarts(text: string): (position: number) => number {
  const ends: number[] = [];
  for (const match of text.matchAll(/[.!?](?=\s)/g)) ends.push(match.index ?? 0);
  return (position) => ends.filter((end) => end < position).length;
}

// Splits a paragraph into plain and marked pieces, for display.
export function markPieces(text: string, marks: LessonMark[]): { text: string; mark?: LessonMark }[] {
  const pieces: { text: string; mark?: LessonMark }[] = [];
  let at = 0;
  for (const mark of [...marks].sort((a, b) => a.start - b.start)) {
    if (mark.start < at || mark.end > text.length) continue;
    if (mark.start > at) pieces.push({ text: text.slice(at, mark.start) });
    pieces.push({ text: text.slice(mark.start, mark.end), mark });
    at = mark.end;
  }
  if (at < text.length) pieces.push({ text: text.slice(at) });
  return pieces;
}
