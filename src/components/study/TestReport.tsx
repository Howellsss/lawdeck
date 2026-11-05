"use client";

import Link from "next/link";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { RecallOutcome } from "@/lib/revision";
import type { StudyCheckpoint } from "@/server/db/study";

// The topic test's report (founder's brief, 16): totals, what the student remembered well, what to
// work on, and the authorities they struggled to recall. Based only on these answers.
export function TestReport({
  questions,
  results,
  onRetry,
}: {
  questions: StudyCheckpoint[];
  results: Record<string, RecallOutcome>;
  onRetry?: () => void;
}) {
  const answered = questions.filter((q) => results[q.id]);
  const count = (outcome: RecallOutcome) => answered.filter((q) => results[q.id] === outcome).length;
  const strong = unique(answered.filter((q) => results[q.id] === "correct").map((q) => q.keyPoint));
  const weak = unique(answered.filter((q) => results[q.id] !== "correct").map((q) => q.keyPoint));
  const authorities = unique(
    answered.filter((q) => results[q.id] !== "correct" && (q.kind === "authority" || q.kind === "statute")).map((q) => q.keyPoint),
  );
  const stat = (label: string, value: number, tone = "") => (
    <div className="flex flex-col rounded-xl border border-line px-3 py-2">
      <span className={`font-serif text-2xl ${tone}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );

  return (
    <section aria-labelledby="report" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <h2 id="report" className="font-serif text-2xl font-normal">
        Your results
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Answered", answered.length)}
        {stat("Correct", count("correct"), "text-success")}
        {stat("Partly", count("partly"))}
        {stat("Missed or skipped", count("incorrect") + count("skipped"), count("incorrect") + count("skipped") ? "text-warning" : "")}
      </div>
      {strong.length > 0 && <List title="You remembered well" items={strong} />}
      {weak.length > 0 && <List title="Worth revisiting" items={weak} />}
      {authorities.length > 0 && <List title="Authorities you struggled to recall" items={authorities} />}
      <p className="text-xs text-muted">
        Based on your answers in this test only, not a prediction of exam results. Missed points come back for revision tomorrow.
      </p>
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className={compactPrimaryButton}>
            Try the missed questions again
          </button>
        )}
        <Link href="/courses" className="self-center text-sm">
          Back to courses
        </Link>
      </div>
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="list-disc pl-5 text-[14.5px] leading-relaxed">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
