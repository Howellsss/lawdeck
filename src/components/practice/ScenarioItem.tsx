"use client";

import { ReportProblem } from "@/components/feedback/ReportProblem";
import { useState } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import type { PracticeReveal } from "@/lib/practice";
import { revealModelAnswer } from "@/server/practice/actions";
import { RevealPanel } from "./RevealPanel";

// One scenario. The student works it through first, then can reveal the model answer.
// Marking of their own written answer arrives in step 4e.
export function ScenarioItem({ number, id, question }: { number: number; id: string; question: string }) {
  const [reveal, setReveal] = useState<PracticeReveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function show() {
    setBusy(true);
    setMessage(undefined);
    const result = await revealModelAnswer(id);
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    setReveal(result);
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-medium">
        <span className="text-muted">Scenario {number}. </span>
      </h3>
      <p className="whitespace-pre-line text-[15px] leading-relaxed">{question}</p>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
      {reveal ? (
        <>
          <RevealPanel reveal={reveal} heading="Model answer" />
          <ReportProblem kind="practice_item" id={id} />
        </>
      ) : (
        <div>
          <button type="button" disabled={busy} onClick={() => void show()} className={compactSecondaryButton}>
            {busy ? "Opening…" : "Show model answer"}
          </button>
        </div>
      )}
    </li>
  );
}
