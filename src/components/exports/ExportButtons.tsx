import { compactSecondaryButton } from "@/components/ui/buttons";
import type { ExportKind } from "@/schemas/exports";

// "Download Word" and "Save as PDF" for a chat, brief or practice set (PRD EX-03). Flashcard
// sets also offer just the cards not known yet.
export function ExportButtons({ kind, id, notKnownOption = false }: { kind: ExportKind; id: string; notKnownOption?: boolean }) {
  const word = `/api/exports/${kind}/${id}`;
  const pdf = `/print/study/${kind}/${id}`;
  return (
    <section aria-label="Export" className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <a href={word} className={`${compactSecondaryButton} no-underline`} download>
          Download Word
        </a>
        <a href={pdf} target="_blank" rel="noopener" className={`${compactSecondaryButton} no-underline`}>
          Save as PDF
        </a>
      </div>
      {notKnownOption && (
        <p className="text-sm text-muted">
          Only the cards you don’t know yet:{" "}
          <a href={`${word}?notKnown=1`} download>
            Word
          </a>{" "}
          ·{" "}
          <a href={`${pdf}?notKnown=1`} target="_blank" rel="noopener">
            PDF
          </a>
        </p>
      )}
    </section>
  );
}
