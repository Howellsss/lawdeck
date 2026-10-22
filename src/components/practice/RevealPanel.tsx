import { AnswerText } from "@/components/learn/AnswerText";
import type { PracticeReveal } from "@/lib/practice";

// The explanation or model answer, and the library sources it came from (titles only).
export function RevealPanel({ reveal, heading }: { reveal: PracticeReveal; heading: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-4">
      <h4 className="font-medium">{heading}</h4>
      <div className="flex flex-col gap-2 text-[15px] leading-relaxed">
        <AnswerText text={reveal.answer} citable={new Set()} />
      </div>
      {reveal.sources.length > 0 && (
        <div className="flex flex-col gap-1 text-sm text-muted">
          <span className="font-medium text-ink">Sources</span>
          <ul className="flex flex-col gap-1">
            {reveal.sources.map((source) => (
              <li key={source.label}>
                [S{source.label}] {[source.title, source.heading, source.pages].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
