import type { ReactNode } from "react";
import { paragraphGroups, type Part, type Placed } from "@/lib/annotations";
import type { LessonContent, LessonMark } from "@/schemas/lesson";

// A lesson's text with its highlights (docs/specs/remembrance.md). Text keeps the ink colour; the
// highlight style (full, quiet or off) comes from the nearest data-highlights attribute. Used by
// reviewers and by students' lesson reader. `after` lets the reader place recall questions after a
// section. Students' own marks (Phase 3a) are drawn inside, in one look of their own; every piece
// of text carries where it starts (data-o) so a new selection can be measured exactly.
export function LessonBody({
  content,
  after,
  upTo,
  onAuthority,
  annotations = [],
  onAnnotation,
}: {
  content: LessonContent;
  after?: (sectionIndex: number) => ReactNode;
  // Show only the sections up to this one (the reader reveals a lesson as the student goes).
  upTo?: number;
  // Makes case and statute names clickable, opening their authority card.
  onAuthority?: (key: string) => void;
  annotations?: Placed[];
  onAnnotation?: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      {content.sections.slice(0, upTo === undefined ? undefined : upTo + 1).map((section, index) => (
        <section key={index} aria-labelledby={`lesson-section-${index}`} className="flex flex-col gap-3">
          <h2 id={`lesson-section-${index}`} className="font-serif text-2xl font-normal">
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph, p) => {
            const here = annotations.filter((a) => a.section === index && a.paragraph === p);
            return (
              <p key={p} data-section={index} data-paragraph={p} className="text-[16px] leading-[1.8]">
                {paragraphGroups(paragraph.text, paragraph.marks, here).map((group, g) => {
                  const clickable = !(group.mark?.authority && onAuthority);
                  const parts = group.parts.map((part) => <PartText key={part.start} part={part} onAnnotation={clickable ? onAnnotation : undefined} />);
                  const notes = group.parts.filter((part) => part.lastOfAnn && part.ann?.note && onAnnotation);
                  return (
                    <span key={g}>
                      {group.mark ? <Marked mark={group.mark} onAuthority={onAuthority}>{parts}</Marked> : parts}
                      {notes.map((part) => (
                        <button
                          key={part.ann!.id}
                          type="button"
                          onClick={() => onAnnotation?.(part.ann!.id)}
                          aria-label={`Your note: ${part.ann!.note}`}
                          title={part.ann!.note ?? ""}
                          className="ann-note"
                        >
                          ✎
                        </button>
                      ))}
                    </span>
                  );
                })}
              </p>
            );
          })}
          {after?.(index)}
        </section>
      ))}
    </div>
  );
}

// One piece of text, inside the student's own mark if it has one.
function PartText({ part, onAnnotation }: { part: Part; onAnnotation?: (id: string) => void }) {
  if (!part.ann) return <span data-o={part.start}>{part.text}</span>;
  const id = part.ann.id;
  return (
    <span
      data-o={part.start}
      className={`ann ann-${part.ann.style}`}
      title="Your mark"
      onClick={onAnnotation ? () => onAnnotation(id) : undefined}
    >
      {part.text}
    </span>
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
function Marked({ mark, children, onAuthority }: { mark: LessonMark; children: ReactNode; onAuthority?: (key: string) => void }) {
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
        {mark.type === "case" ? <i>{children}</i> : children}
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
      {mark.type === "case" ? <i>{children}</i> : children}
    </span>
  );
}
