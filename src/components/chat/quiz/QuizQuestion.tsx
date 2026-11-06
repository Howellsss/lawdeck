"use client";

import type { QuizState } from "@/lib/quiz";
import { QuizChart } from "./QuizChart";
import { QuizReady } from "./QuizReady";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// One live question: the timer, the question and its choices as large buttons. Once it closes
// (time up or everyone answered), the right answer, the student's result and the explanation show.
export function QuizQuestion({ quiz, busy, onAnswer }: { quiz: QuizState; busy: boolean; onAnswer: (choice: number) => void }) {
  if (quiz.readyIn > 0) return <QuizReady readyIn={quiz.readyIn} current={quiz.current} total={quiz.total} />;
  const q = quiz.question;
  if (!q) return null;
  const answered = quiz.myChoice !== null;
  const share = quiz.seconds ? Math.max(0, Math.min(1, quiz.secondsLeft / quiz.seconds)) : 0;
  return (
    <section aria-label={`Question ${quiz.current + 1} of ${quiz.total}`} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 text-[14px] text-muted">
        <span>
          Question {quiz.current + 1} of {quiz.total}
        </span>
        <span aria-live="polite" className="font-medium tabular-nums text-ink">
          {quiz.closed ? "Time’s up" : `${Math.ceil(quiz.secondsLeft)}s`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-pill" aria-hidden>
        <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${share < 0.25 ? "bg-warning" : "bg-ink"}`} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="font-serif text-[22px] leading-snug">{q.prompt}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {q.choices.map((choice, i) => {
          const mine = quiz.myChoice === i;
          const right = quiz.closed && quiz.correctChoice === i;
          const wrong = quiz.closed && mine && !right;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={answered || quiz.closed || busy || !quiz.joined}
                onClick={() => onAnswer(i)}
                aria-pressed={mine}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-[16px] ${
                  right ? "border-success" : wrong ? "border-warning" : mine ? "border-ink bg-pill" : "border-line bg-surface hover:border-muted"
                } disabled:cursor-default`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pill text-[14px] font-semibold">{LETTERS[i]}</span>
                <span className="flex-1">{choice}</span>
                {right && <span className="text-[13px] font-medium text-success">Right answer</span>}
                {wrong && <span className="text-[13px] font-medium text-warning">Your answer</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {quiz.closed ? (
        <div role="status" className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-[15px]">
          <p className="font-medium">
            {quiz.myCorrect ? (
              <span className="text-success">
                Correct! +{quiz.myPoints} points{quiz.myStreak > 1 && ` · 🔥 ${quiz.myStreak} in a row`}
              </span>
            ) : answered ? (
              <span className="text-warning">Not this time.</span>
            ) : (
              <span className="text-muted">No answer this time.</span>
            )}
          </p>
          {quiz.explanation && <p className="text-muted">{quiz.explanation}</p>}
        </div>
      ) : null}
      {quiz.closed && quiz.counts && <QuizChart counts={quiz.counts} correct={quiz.correctChoice} />}
      {!quiz.closed && (
        <p className="text-[14px] text-muted" aria-live="polite">
          {answered ? "Answer locked in. Waiting for the others…" : quiz.joined ? "Choose your answer." : "Join the quiz to answer."} {quiz.answered} of {quiz.players} answered.
        </p>
      )}
    </section>
  );
}
