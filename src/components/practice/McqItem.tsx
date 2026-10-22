"use client";

import { useState } from "react";
import { choiceLetter, type PracticeReveal } from "@/lib/practice";
import { answerMultipleChoice } from "@/server/practice/actions";
import { RevealPanel } from "./RevealPanel";

// One multiple-choice question. The server checks the answer and only then reveals the correct
// option and explanation. Green means correct and amber means wrong (colour only for meaning).
export function McqItem({
  number,
  id,
  question,
  choices,
  chosen: initialChosen,
  reveal: initialReveal,
}: {
  number: number;
  id: string;
  question: string;
  choices: string[];
  chosen: number | null;
  reveal: PracticeReveal | null;
}) {
  const [chosen, setChosen] = useState(initialChosen);
  const [reveal, setReveal] = useState(initialReveal);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function pick(choice: number) {
    setBusy(true);
    setMessage(undefined);
    const result = await answerMultipleChoice({ itemId: id, choice });
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    setChosen(choice);
    setReveal(result);
  }

  const answered = chosen !== null && reveal !== null;
  const right = answered && reveal.correctChoice === chosen;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-medium">
        <span className="text-muted">Question {number}. </span>
        {question}
      </h3>
      <ul className="flex flex-col gap-2">
        {choices.map((choice, index) => {
          const isCorrect = answered && reveal.correctChoice === index;
          const isWrongPick = answered && chosen === index && !isCorrect;
          return (
            <li key={index}>
              <button
                type="button"
                disabled={answered || busy}
                onClick={() => void pick(index)}
                aria-pressed={chosen === index}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-[15px] enabled:hover:bg-pill ${
                  isCorrect ? "border-success" : isWrongPick ? "border-warning" : "border-line"
                }`}
              >
                <span className="font-medium">{choiceLetter(index)}.</span>
                <span className="min-w-0 flex-1 break-words">{choice}</span>
                {isCorrect && <span className="text-sm text-success">Correct answer</span>}
                {isWrongPick && <span className="text-sm text-warning">Your answer</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
      {answered && (
        <>
          <p role="status" className={`font-medium ${right ? "text-success" : "text-warning"}`}>
            {right ? "Correct." : `Not quite: the answer is ${choiceLetter(reveal.correctChoice ?? 0)}.`}
          </p>
          <RevealPanel reveal={reveal} heading="Why" />
        </>
      )}
    </li>
  );
}
