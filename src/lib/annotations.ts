import type { LessonContent, LessonMark } from "@/schemas/lesson";
import { markPieces } from "./lessonMarks";

// Students' own marks in a lesson (Remembrance Phase 3a, migration 51).
export const ANNOTATION_STYLES = ["highlight", "circle", "underline"] as const;
export type AnnotationStyle = (typeof ANNOTATION_STYLES)[number];
export type Annotation = {
  id: string;
  lessonId: string | null;
  section: number;
  paragraph: number;
  start: number;
  end: number;
  quote: string;
  style: AnnotationStyle;
  note: string | null;
};
export type Placed = Annotation & { section: number; paragraph: number; start: number; end: number };

// Where a mark belongs in this version of the lesson: where it was if the words are still there,
// else the same words in the same paragraph, else anywhere in the lesson; null when the words are
// gone (it is then shown as a note from an earlier version, never lost).
export function placeAnnotation(a: Annotation, content: LessonContent): Placed | null {
  const text = (s: number, p: number) => content.sections[s]?.paragraphs[p]?.text;
  const here = text(a.section, a.paragraph);
  if (here !== undefined && here.slice(a.start, a.end) === a.quote) return a;
  if (here !== undefined) {
    const at = here.indexOf(a.quote);
    if (at >= 0) return { ...a, start: at, end: at + a.quote.length };
  }
  for (const [s, section] of content.sections.entries()) {
    for (const [p, paragraph] of section.paragraphs.entries()) {
      const at = paragraph.text.indexOf(a.quote);
      if (at >= 0) return { ...a, section: s, paragraph: p, start: at, end: at + a.quote.length };
    }
  }
  return null;
}

export type Part = { start: number; text: string; ann?: Placed; lastOfAnn?: boolean };
export type Group = { mark?: LessonMark; parts: Part[] };

// A paragraph cut into Lawdeck's highlighted phrases (groups) and, inside them, the student's own
// marks (parts). Each part knows where it starts, so a new selection can be measured exactly.
// Where two student marks overlap, the later one shows.
export function paragraphGroups(text: string, marks: LessonMark[], anns: Placed[]): Group[] {
  const groups: Group[] = [];
  let offset = 0;
  for (const piece of markPieces(text, marks)) {
    const from = offset;
    const to = offset + piece.text.length;
    offset = to;
    const cuts = new Set([from, to]);
    for (const a of anns) {
      if (a.start > from && a.start < to) cuts.add(a.start);
      if (a.end > from && a.end < to) cuts.add(a.end);
    }
    const points = [...cuts].sort((x, y) => x - y);
    const parts: Part[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const s = points[i] ?? 0;
      const e = points[i + 1] ?? s;
      if (e <= s) continue;
      const ann = [...anns].reverse().find((a) => a.start <= s && a.end >= e);
      parts.push({ start: s, text: text.slice(s, e), ann, lastOfAnn: ann ? ann.end === e : false });
    }
    groups.push({ mark: piece.mark, parts });
  }
  return groups;
}
