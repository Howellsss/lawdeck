"use client";

import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import type { RecallOutcome } from "@/lib/revision";
import type { StudyCheckpoint } from "@/server/db/study";
import { recordAnswer, revealAnswer } from "@/server/study/actions";

type Result = { outcome: RecallOutcome; answer: string; explanation: string | null; correctChoice: number | null };

const OUTCOME_TEXT: Record<RecallOutcome, string> = {
  correct: "You remembered it.",
  partly: "Partly there.",
  incorrect: "Not this time. It will come back for revision.",
  skipped: "Skipped. It will come back for revision.",
};

// One recall question. The answer stays on the server until the student tries (founder's brief, 17):
// multiple choice is marked by Lawdeck; for a written answer the student compares it with the
// model answer and says how it went.
export function RecallCard({
  checkpoint,
  sessionId,
  context,
  onDone,
}: {
  checkpoint: StudyCheckpoint;
  sessionId: string | null;
  context: "reading" | "test" | "revision";
  onDone?: (outcome: RecallOutcome) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [revealed, setRevealed] = useState<{ answer: string; explanation: string | null } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const mcq = checkpoint.kind === "mcq" && checkpoint.choices;

  async function finish(input: { choice?: number | null; selfOutcome?: "correct" | "partly" | "incorrect"; skipped?: boolean }) {
    setBusy(true);
    setError(undefined);
    const saved = await recordAnswer({ sessionId, checkpointId: checkpoint.id, context, answer: text, ...input });
    setBusy(false);
    if (!saved.ok) return setError(saved.message);
    setResult(saved);
    onDone?.(saved.outcome);
  }

  async function reveal() {
    setBusy(true);
    setError(undefined);
    const shown = await revealAnswer({ checkpointId: checkpoint.id, answer: text });
    setBusy(false);
    if (!shown.ok) return setError(shown.message);
    setRevealed(shown);
  }

  return (
    <div role="group" aria-label="Recall question" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-muted">Recall · {checkpoint.keyPoint}</p>
      <p className="text-[15.5px] font-medium leading-relaxed">{checkpoint.prompt}</p>

      {mcq ? (
        <fieldset disabled={Boolean(result) || busy} className="flex flex-col gap-2">
          <legend className="sr-only">Choose an answer</legend>
          {checkpoint.choices!.map((option, i) => {
            const right = result && result.correctChoice === i;
            const wrongPick = result && choice === i && result.correctChoice !== i;
            return (
              <label
                key={i}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
                  right ? "border-success" : wrongPick ? "border-warning" : choice === i ? "border-ink" : "border-line"
                }`}
              >
                <input type="radio" name={`choice-${checkpoint.id}`} checked={choice === i} onChange={() => setChoice(i)} className="mt-1" />
                <span>{option}</span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        <>
          <label htmlFor={`answer-${checkpoint.id}`} className="sr-only">
            Your answer
          </label>
          <textarea
            id={`answer-${checkpoint.id}`}
            rows={3}
            maxLength={4000}
            value={text}
            disabled={Boolean(revealed) || busy}
            onChange={(event) => setText(event.target.value)}
            placeholder="Answer from memory, then check"
            className="rounded-xl border border-line bg-paper px-3 py-2 text-[15px]"
          />
        </>
      )}

      {(revealed || result) && (
        <div className="flex flex-col gap-1 rounded-xl bg-pill px-3 py-2.5 text-[14.5px]">
          <span>
            <span className="text-muted">Answer: </span>
            {(result ?? revealed)!.answer}
          </span>
          {(result ?? revealed)!.explanation && <span className="text-muted">{(result ?? revealed)!.explanation}</span>}
        </div>
      )}
      {result && (
        <p role="status" className={`text-sm ${result.outcome === "correct" ? "text-success" : "text-warning"}`}>
          {OUTCOME_TEXT[result.outcome]}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      )}

      {!result && (
        <div className="flex flex-wrap gap-2">
          {mcq && (
            <button type="button" disabled={busy || choice === null} onClick={() => void finish({ choice })} className={compactPrimaryButton}>
              Check
            </button>
          )}
          {!mcq && !revealed && (
            <button type="button" disabled={busy || !text.trim()} onClick={() => void reveal()} className={compactPrimaryButton}>
              Check my answer
            </button>
          )}
          {!mcq && revealed && (
            <>
              <span className="w-full text-sm text-muted">How did your answer compare?</span>
              <button type="button" disabled={busy} onClick={() => void finish({ selfOutcome: "correct" })} className={compactSecondaryButton}>
                Got it
              </button>
              <button type="button" disabled={busy} onClick={() => void finish({ selfOutcome: "partly" })} className={compactSecondaryButton}>
                Partly
              </button>
              <button type="button" disabled={busy} onClick={() => void finish({ selfOutcome: "incorrect" })} className={compactSecondaryButton}>
                Missed it
              </button>
            </>
          )}
          {!revealed && (
            <button type="button" disabled={busy} onClick={() => void finish({ skipped: true })} className="text-sm text-muted underline underline-offset-2">
              Skip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
