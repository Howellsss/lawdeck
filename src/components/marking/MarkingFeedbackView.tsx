import { AnswerText } from "@/components/learn/AnswerText";
import type { MarkingFeedback } from "@/schemas/marking";

// The marking of one answer (PRD LN-08): the score, each marking point with the marks given and
// what was good or missing, the correct rule from the library, and advice. Shown in the right panel.
export function MarkingFeedbackView({ feedback }: { feedback: MarkingFeedback }) {
  const share = feedback.max > 0 ? feedback.total / feedback.max : 0;
  return (
    <div className="flex flex-col gap-5 text-[15px] leading-relaxed">
      <p className="text-2xl font-semibold">
        <span className={share >= 0.5 ? "text-success" : "text-warning"}>{feedback.total}</span>
        <span className="text-muted"> / {feedback.max} marks</span>
      </p>
      <section className="flex flex-col gap-3">
        <h3 className="font-medium">Marking guide</h3>
        <ol className="flex flex-col gap-3">
          {feedback.points.map((point, index) => (
            <li key={index} className="flex flex-col gap-1 rounded-xl border border-line p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{point.point}</span>
                <span className={`shrink-0 text-sm ${point.awarded === point.max ? "text-success" : point.awarded === 0 ? "text-warning" : "text-muted"}`}>
                  {point.awarded} / {point.max}
                </span>
              </div>
              {point.good && <p className="text-sm">Good: {point.good}</p>}
              {point.missing && <p className="text-sm text-muted">Missing: {point.missing}</p>}
            </li>
          ))}
        </ol>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">The correct rule</h3>
        <AnswerText text={feedback.correctRule} citable={new Set()} />
        {feedback.sources.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {feedback.sources.map((source) => (
              <li key={source.label}>
                [S{source.label}] {[source.title, source.heading, source.pages].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        )}
      </section>
      {feedback.overall && (
        <section className="flex flex-col gap-2">
          <h3 className="font-medium">How to earn more marks</h3>
          <p>{feedback.overall}</p>
        </section>
      )}
    </div>
  );
}
