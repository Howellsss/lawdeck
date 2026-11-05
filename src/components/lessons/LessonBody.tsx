import { markPieces } from "@/lib/lessonMarks";
import type { LessonContent, LessonMark } from "@/schemas/lesson";

// A lesson's text with its highlights (docs/specs/remembrance.md). Text keeps the ink colour; the
// highlight style (full, quiet or off) comes from the nearest data-highlights attribute. Used by
// reviewers now and by students' lesson reader. `after` lets the reader place recall questions
// after a section.
export function LessonBody({
  content,
  after,
}: {
  content: LessonContent;
  after?: (sectionIndex: number) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      {content.sections.map((section, index) => (
        <section key={index} aria-labelledby={`lesson-section-${index}`} className="flex flex-col gap-3">
          <h2 id={`lesson-section-${index}`} className="font-serif text-2xl font-normal">
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph, p) => (
            <p key={p} className="text-[16px] leading-[1.8]">
              {markPieces(paragraph.text, paragraph.marks).map((piece, i) =>
                piece.mark ? <Marked key={i} mark={piece.mark} text={piece.text} /> : <span key={i}>{piece.text}</span>,
              )}
            </p>
          ))}
          {after?.(index)}
        </section>
      ))}
    </div>
  );
}

const LABELS: Record<LessonMark["type"], string> = {
  case: "Case",
  principle: "Principle",
  statute: "Statute",
  tip: "Exam tip",
  exception: "Exception",
  definition: "Definition",
};

// One highlighted phrase. The category is also given in words for screen readers, so meaning
// never depends on colour alone (WCAG 1.4.1).
function Marked({ mark, text }: { mark: LessonMark; text: string }) {
  const symbol = mark.type === "tip" ? "★" : mark.type === "exception" ? "⚠" : null;
  return (
    <span className={`mark mark-${mark.type}`} data-authority={mark.authority}>
      {symbol && (
        <span aria-hidden="true" className="mark-symbol">
          {symbol}
        </span>
      )}
      <span className="sr-only">{LABELS[mark.type]}: </span>
      {mark.type === "case" ? <i>{text}</i> : text}
    </span>
  );
}
