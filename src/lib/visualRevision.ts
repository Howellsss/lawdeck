import type { LessonContent, MarkType } from "@/schemas/lesson";
import type { Placed } from "./annotations";

// Visual Revision Mode (founder's brief, section 31; Phase 3b): a topic's important points without
// rereading every paragraph. Each item is one marked phrase in its own sentence, from Lawdeck's
// highlights or the student's own marks.
export const REVISION_FILTERS = ["case", "statute", "principle", "definition", "tip", "exception", "mine"] as const;
export type RevisionFilter = (typeof REVISION_FILTERS)[number];

export type RevisionItem = {
  key: string;
  kind: MarkType | "mine";
  section: number;
  // The sentence around the phrase, and where the phrase sits in it.
  sentence: string;
  start: number;
  end: number;
  authority?: string;
  note?: string | null;
  style?: Placed["style"];
};

// The sentence a phrase sits in: from just after the previous . ! or ? to the next one.
export function sentenceAround(text: string, start: number, end: number): { sentence: string; start: number; end: number } {
  let from = 0;
  for (const match of text.slice(0, start).matchAll(/[.!?]\s+/g)) from = (match.index ?? 0) + match[0].length;
  const next = text.slice(end).search(/[.!?](\s|$)/);
  const to = next < 0 ? text.length : end + next + 1;
  return { sentence: text.slice(from, to).trim(), start: start - from, end: end - from };
}

export function revisionItems(content: LessonContent, marks: Placed[]): RevisionItem[] {
  const items: RevisionItem[] = [];
  content.sections.forEach((section, s) => {
    section.paragraphs.forEach((paragraph, p) => {
      const here: { start: number; item: RevisionItem }[] = [];
      for (const [i, mark] of paragraph.marks.entries()) {
        const at = sentenceAround(paragraph.text, mark.start, mark.end);
        here.push({ start: mark.start, item: { key: `m-${s}-${p}-${i}`, kind: mark.type, section: s, ...at, authority: mark.authority } });
      }
      for (const mine of marks.filter((m) => m.section === s && m.paragraph === p)) {
        const at = sentenceAround(paragraph.text, mine.start, mine.end);
        here.push({ start: mine.start, item: { key: `a-${mine.id}`, kind: "mine", section: s, ...at, note: mine.note, style: mine.style } });
      }
      here.sort((a, b) => a.start - b.start).forEach(({ item }) => items.push(item));
    });
  });
  return items;
}
