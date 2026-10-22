import { AnswerText } from "@/components/learn/AnswerText";
import type { EvalAnswer } from "@/server/db/evals";
import { RateAnswerForm } from "./RateAnswerForm";

const PUSHBACK_LABELS: Record<string, string> = {
  wrong_statement: "Student states something wrong",
  holds_position: "Student pushes back without a source",
  fake_authority: "Student cites a made-up authority",
  valid_correction: "Student gives a valid correction",
};

const NO_CITATIONS = new Set<number>();

// One test case: what was asked, what a correct answer must do, and each model's answer,
// shown as "Answer A, B, C" so the reviewer does not know which model wrote which.
export function EvalCaseView({ answers }: { answers: EvalAnswer[] }) {
  const first = answers[0];
  if (!first) return null;
  return (
    <section aria-labelledby="case-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-line p-4">
        <h2 id="case-heading" className="text-lg font-medium">
          {first.caseId} · {first.pushbackType ? PUSHBACK_LABELS[first.pushbackType] : first.topic}
          {first.level && <span className="text-sm font-normal text-muted"> · {first.level === "simple" ? "Simple" : "Exam-ready"}</span>}
        </h2>
        {first.turns.length > 0 && (
          <ol className="flex flex-col gap-2 text-[15px]">
            {first.turns.map((turn, i) => (
              <li key={i} className={turn.role === "user" ? "" : "text-muted"}>
                <span className="font-medium">{turn.role === "user" ? "Student: " : "Earlier answer: "}</span>
                {turn.text}
              </li>
            ))}
          </ol>
        )}
        <p className="text-[15px]">
          <span className="font-medium">Student: </span>
          {first.question}
        </p>
        {first.expect && <p className="text-sm"><span className="font-medium">A correct reply must: </span>{first.expect}</p>}
        {first.mustInclude.length > 0 && (
          <div className="text-sm">
            <p className="font-medium">Points from the notes</p>
            <ul className="list-disc pl-5">
              {first.mustInclude.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {answers.map((answer, i) => {
        const label = `Answer ${String.fromCharCode(65 + i)}`;
        return (
          <article key={answer.id} aria-label={label} className="flex flex-col gap-3 rounded-2xl border border-line p-4 text-[15px] leading-relaxed">
            <h3 className="font-medium">{label}</h3>
            {answer.error ? (
              <p className="text-warning">No answer: {answer.error}</p>
            ) : (
              <AnswerText text={answer.answer ?? ""} citable={NO_CITATIONS} />
            )}
            <p className="text-sm text-muted">
              {[
                answer.grade && answer.grade.pointsTotal > 0 && `Grader: ${answer.grade.pointsCovered} of ${answer.grade.pointsTotal} points`,
                answer.grade?.pushbackOk !== null && answer.grade?.pushbackOk !== undefined && `pushback ${answer.grade.pushbackOk ? "handled" : "not handled"}`,
                answer.removedAuthorities ? `${answer.removedAuthorities} made-up authorit${answer.removedAuthorities === 1 ? "y" : "ies"} removed` : null,
                answer.notEnough && "said “not enough in the library”",
                answer.sources.length > 0 && `cites ${answer.sources.map((s) => s.title).filter((t, j, all) => all.indexOf(t) === j).join("; ")}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {answer.grade?.note && <p className="text-sm text-muted">Grader’s note: {answer.grade.note}</p>}
            {!answer.error && <RateAnswerForm id={answer.id} label={label} rating={answer.rating} note={answer.reviewNote} />}
          </article>
        );
      })}
    </section>
  );
}
