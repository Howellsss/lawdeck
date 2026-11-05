import { markPieces } from "@/lib/lessonMarks";
import type { LessonContent, LessonMark } from "@/schemas/lesson";

// A lesson's text with its highlights (docs/specs/remembrance.md). Text keeps the ink colour; the
// highlight style (full, quiet or off) comes from the nearest data-highlights attribute. Used by
// reviewers now and by students' lesson reader. `after` lets the reader place recall questions
// after a section.
export function LessonBody({
  content,
  after,
  upTo,
  onAuthority,
}: {
  content: LessonContent;
  after?: (sectionIndex: number) => React.ReactNode;
  // Show only the sections up to this one (the reader reveals a lesson as the student goes).
  upTo?: number;
  // Makes case and statute names clickable, opening their authority card.
  onAuthority?: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      {content.sections.slice(0, upTo === undefined ? undefined : upTo + 1).map((section, index) => (
        <section key={index} aria-labelledby={`lesson-section-${index}`} className="flex flex-col gap-3">
          <h2 id={`lesson-section-${index}`} className="font-serif text-2xl font-normal">
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph, p) => (
            <p key={p} className="text-[16px] leading-[1.8]">
              {markPieces(paragraph.text, paragraph.marks).map((piece, i) =>
                piece.mark ? <Marked key={i} mark={piece.mark} text={piece.text} onAuthority={onAuthority} /> : <span key={i}>{piece.text}</span>,
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
function Marked({ mark, text, onAuthority }: { mark: LessonMark; text: string; onAuthority?: (key: string) => void }) {
  const symbol = mark.type === "tip" ? "★" : mark.type === "exception" ? "⚠" : null;
  if (mark.authority && onAuthority) {
    const key = mark.authority;
    return (
      <button
        type="button"
        onClick={() => onAuthority(key)}
        title="Open the authority card"
        className={`mark mark-${mark.type} cursor-pointer text-left text-ink underline decoration-dotted underline-offset-4`}
      >
        <span className="sr-only">{LABELS[mark.type]}, open its card: </span>
        {mark.type === "case" ? <i>{text}</i> : text}
      </button>
    );
  }
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
