import { formatDateWat } from "@/lib/dates";
import type { TemplateSpec } from "@/schemas/drafting";

const KIND = {
  fixed: "Fixed wording",
  narrative: "Written by Lawdeck from the intake",
  signature: "Signature block",
};
const FIELD_TYPE = {
  text: "short text",
  longText: "long text",
  date: "date",
  money: "amount",
  number: "number",
  party: "party",
  address: "address",
};

// A template's parts in order, with the wording, what the AI writes, and why each part is there;
// then the intake questions. Read-only: templates are changed in their file (rule H-03).
export function TemplateSpecView({ spec }: { spec: TemplateSpec }) {
  return (
    <>
      <section aria-labelledby="parts" className="flex flex-col gap-3">
        <h2 id="parts" className="font-serif text-2xl font-normal">
          Parts, in order
        </h2>
        <ol className="flex flex-col gap-3">
          {spec.parts.map((part, index) => (
            <li
              key={part.id}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4"
            >
              <p className="font-medium break-words">
                {index + 1}. {part.heading ?? part.id}
                <span className="font-normal text-muted">
                  {" "}
                  · {KIND[part.kind]}
                  {part.required ? "" : " · optional"}
                  {part.forums ? ` · only for ${part.forums.join(", ")}` : ""}
                </span>
              </p>
              {part.text && (
                <p className="whitespace-pre-wrap break-words font-serif">
                  {part.text}
                </p>
              )}
              {part.instruction && (
                <p className="text-sm break-words">
                  Instruction ({part.maxWords} words at most):{" "}
                  {part.instruction}
                </p>
              )}
              <p className="text-sm text-muted break-words">Why: {part.why}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="fields" className="flex flex-col gap-3">
        <h2 id="fields" className="font-serif text-2xl font-normal">
          Intake questions
        </h2>
        {spec.fields.length === 0 ? (
          <p className="text-muted">This template asks no questions.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {spec.fields.map((field) => (
              <li key={field.id} className="flex flex-col gap-1 px-4 py-3">
                <p className="break-words">{field.question}</p>
                <p className="text-sm text-muted">
                  {field.label} · {FIELD_TYPE[field.type]} ·{" "}
                  {field.required ? "required" : "optional"}
                  {field.repeatable ? " · more than one allowed" : ""} · if
                  missing:{" "}
                  <span className="placeholder">[{field.placeholder}]</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(spec.definedTerms.length > 0 || spec.related.length > 0) && (
        <section aria-labelledby="extras" className="flex flex-col gap-2">
          <h2 id="extras" className="font-serif text-2xl font-normal">
            Checks and related documents
          </h2>
          {spec.definedTerms.length > 0 && (
            <p className="break-words">
              Defined terms checked: {spec.definedTerms.join(", ")}
            </p>
          )}
          {spec.related.length > 0 && (
            <p className="break-words">
              Usually goes with: {spec.related.join(", ")}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="changes" className="flex flex-col gap-2">
        <h2 id="changes" className="font-serif text-2xl font-normal">
          Change log
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {spec.changeLog.map((entry) => (
            <li key={`${entry.date}-${entry.note}`} className="break-words">
              {formatDateWat(entry.date)}: {entry.note}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
