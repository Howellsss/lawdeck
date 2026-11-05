"use client";

import Link from "next/link";
import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { RecallOutcome } from "@/lib/revision";
import type { DueQuestion } from "@/server/db/revision";
import { RecallCard } from "./RecallCard";

// The memory challenge (founder's brief, 24–25): due questions one at a time, recorded as
// revision so the next date adapts to the answer. Afterwards: what was remembered, a refresher
// link for anything missed, and on to today's study. Reinforcement, never a block.
export function RevisionRound({ questions }: { questions: DueQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, RecallOutcome>>({});
  const [done, setDone] = useState(false);
  const current = questions[index];
  const answered = current ? Boolean(results[current.id]) : false;

  if (done || !current) {
    const missed = questions.filter((q) => results[q.id] && results[q.id] !== "correct");
    const remembered = questions.filter((q) => results[q.id] === "correct").length;
    const refresh = [...new Map(missed.map((q) => [q.topicId, q.topicName])).entries()];
    return (
      <section aria-labelledby="revision-done" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
        <h2 id="revision-done" className="font-serif text-2xl font-normal">
          {remembered === Object.keys(results).length && remembered > 0 ? "All remembered. Well done." : "Revision done"}
        </h2>
        <p className="text-[15px]">
          {Object.keys(results).length === 0 ? (
            "Nothing answered this time. These questions will wait for you."
          ) : (
            <>
              You remembered <span className="text-success">{remembered}</span> of {Object.keys(results).length}. Remembered points come back later; missed ones come back tomorrow.
            </>
          )}
        </p>
        {refresh.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">A quick refresher</h3>
            <ul className="flex flex-col gap-1 text-[15px]">
              {refresh.map(([topicId, name]) => (
                <li key={topicId}>
                  <Link href={`/study/${topicId}`}>Read {name} again</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-[15px] font-medium text-on-ink no-underline">
            Continue to today&rsquo;s study
          </Link>
          <Link href="/diary" className="text-sm">
            See it in your Study Diary
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="revision" className="flex flex-col gap-3">
      <h2 id="revision" className="sr-only">
        Memory challenge
      </h2>
      <p className="text-sm text-muted">
        Question {index + 1} of {questions.length} · from {current.topicName}
      </p>
      <RecallCard
        key={current.id}
        checkpoint={current}
        sessionId={null}
        context="revision"
        onDone={(outcome) => setResults((r) => ({ ...r, [current.id]: outcome }))}
      />
      <div className="flex flex-wrap items-center gap-3">
        {answered && (
          <button
            type="button"
            className={compactPrimaryButton}
            onClick={() => (index + 1 < questions.length ? setIndex(index + 1) : setDone(true))}
          >
            {index + 1 < questions.length ? "Next question" : "See how I did"}
          </button>
        )}
        <button type="button" onClick={() => setDone(true)} className="text-sm text-muted underline underline-offset-2">
          Stop here and carry on studying
        </button>
      </div>
    </section>
  );
}
