"use client";

import { useRef } from "react";
import { HighlightFrame } from "@/components/lessons/HighlightFrame";
import { LessonBody } from "@/components/lessons/LessonBody";
import { AnnotationBar } from "@/components/study/AnnotationBar";
import { EarlierNotes } from "@/components/study/EarlierNotes";
import { useAnnotations } from "@/components/study/useAnnotations";
import type { LessonContent } from "@/schemas/lesson";

const text = "A wombat summons suits questions of construction. The court will not decide disputed facts on affidavits alone.";
const content: LessonContent = {
  sections: [{ heading: "When to use a wombat summons", paragraphs: [{ text, sources: [1], marks: [{ start: 2, end: 16, type: "definition" }] }] }],
  sources: [],
};
const id = (n: number) => `00000000-0000-4000-8000-0000000007${String(n).padStart(2, "0")}`;

// The real reader pieces on made-up text: two saved marks (one with a note), one from an earlier
// version, and live selection. Saving needs an account, so the bar shows the sign-in message.
export function Marks() {
  const root = useRef<HTMLDivElement>(null);
  const marks = useAnnotations(root, {
    topicId: id(1),
    lessonId: id(2),
    content,
    initial: [
      { id: id(3), lessonId: id(2), section: 0, paragraph: 0, start: 54, end: 63, quote: "court wil", style: "underline", note: null },
      { id: id(4), lessonId: id(2), section: 0, paragraph: 0, start: 85, end: 100, quote: text.slice(85, 100), style: "circle", note: "Made-up note" },
      { id: id(5), lessonId: id(2), section: 0, paragraph: 0, start: 0, end: 5, quote: "Gone words", style: "highlight", note: null },
    ],
  });
  return (
    <>
      <div ref={root}>
        <HighlightFrame>
          <LessonBody content={content} annotations={marks.placed} onAnnotation={marks.edit} />
        </HighlightFrame>
      </div>
      <EarlierNotes notes={marks.earlier} onRemove={marks.remove} />
      <p data-testid="pending">{marks.pending ? `${marks.pending.start}-${marks.pending.end}:${marks.pending.quote}` : "none"}</p>
      <AnnotationBar
        key={marks.editing?.id ?? (marks.pending ? String(marks.pending.start) : "none")}
        pending={marks.pending}
        editing={marks.editing}
        error={marks.error}
        onAdd={marks.add}
        onChange={marks.change}
        onRemove={marks.remove}
        onClose={marks.close}
      />
    </>
  );
}
