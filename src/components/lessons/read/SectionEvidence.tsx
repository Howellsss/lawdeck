import type { Authority, Checkpoint } from "@/server/db/lessons";

// What to check under a section (skim, tick and approve): the cases and statutes it names, each
// already matched in the library by Lawdeck's citation check, and its recall questions with answers.
export function SectionEvidence({ authorities, questions }: { authorities: Authority[]; questions: Checkpoint[] }) {
  if (authorities.length === 0 && questions.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
      {authorities.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Named here</p>
          <ul className="flex flex-col gap-1.5">
            {authorities.map((a) => (
              <li key={a.id} className="flex flex-col">
                <span>
                  <span className="text-success">✓ Found in the library</span> · {a.kind === "case" ? <i>{a.name}</i> : a.name}
                  {a.citation ? ` ${a.citation}` : ""}
                </span>
                <span className="text-muted">Principle: {a.principle}</span>
                {a.kind === "case" && !(a.facts_from_library && a.facts) && <span className="text-warning">Facts not in the library: verification required.</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {questions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Recall questions here</p>
          <ol className="flex flex-col gap-2">
            {questions.map((q) => (
              <li key={q.id} className="flex flex-col gap-0.5">
                <span className="font-medium">{q.prompt}</span>
                {Array.isArray(q.choices) && (
                  <span className="text-muted">
                    {(q.choices as string[]).map((c, i) => `${String.fromCharCode(65 + i)}. ${c}${i === q.correct_choice ? " ✓" : ""}`).join("   ")}
                  </span>
                )}
                <span>
                  <span className="text-muted">Answer: </span>
                  {q.answer}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
