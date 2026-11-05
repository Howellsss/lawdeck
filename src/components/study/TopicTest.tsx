"use client";

import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { RecallOutcome } from "@/lib/revision";
import type { StudyCheckpoint } from "@/server/db/study";
import { RecallCard } from "./RecallCard";
import { TestReport } from "./TestReport";

// The end-of-topic test (founder's brief, 16): one question at a time, then a report. Missed
// questions can be tried again straight away; every answer is saved and feeds revision.
export function TopicTest({
  questions,
  sessionId,
  onFinished,
}: {
  questions: StudyCheckpoint[];
  sessionId: string | null;
  onFinished: () => void;
}) {
  const [round, setRound] = useState(questions);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, RecallOutcome>>({});
  const [answeredThis, setAnsweredThis] = useState(false);
  const [done, setDone] = useState(false);

  if (questions.length === 0) {
    return <p className="text-sm text-muted">This lesson has no test questions yet.</p>;
  }

  if (done) {
    const missed = questions.filter((q) => results[q.id] && results[q.id] !== "correct");
    return (
      <TestReport
        questions={questions}
        results={results}
        onRetry={
          missed.length
            ? () => {
                setRound(missed);
                setIndex(0);
                setAnsweredThis(false);
                setDone(false);
              }
            : undefined
        }
      />
    );
  }

  const current = round[index];
  const last = index === round.length - 1;
  return (
    <section aria-labelledby="topic-test" className="flex flex-col gap-3">
      <h2 id="topic-test" className="font-serif text-2xl font-normal">
        Topic test
      </h2>
      <p className="text-sm text-muted">
        Question {index + 1} of {round.length}. Answer from memory: there&rsquo;s no going back to the lesson until you finish.
      </p>
      <RecallCard
        key={current.id}
        checkpoint={current}
        sessionId={sessionId}
        context="test"
        onDone={(outcome) => {
          setResults((r) => ({ ...r, [current.id]: outcome }));
          setAnsweredThis(true);
        }}
      />
      <div className="flex gap-2">
        {answeredThis && !last && (
          <button
            type="button"
            className={compactPrimaryButton}
            onClick={() => {
              setIndex(index + 1);
              setAnsweredThis(false);
            }}
          >
            Next question
          </button>
        )}
        {answeredThis && last && (
          <button
            type="button"
            className={compactPrimaryButton}
            onClick={() => {
              setDone(true);
              onFinished();
            }}
          >
            See my results
          </button>
        )}
        {!answeredThis && (
          <span className="text-sm text-muted" aria-live="polite">
            Answer or skip to continue.
          </span>
        )}
      </div>
    </section>
  );
}
