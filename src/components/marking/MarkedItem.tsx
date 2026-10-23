"use client";

import { useEffect } from "react";
import { useRightPanel } from "@/components/shell/panelContext";
import { compactSecondaryButton } from "@/components/ui/buttons";
import type { MarkingFeedback } from "@/schemas/marking";
import { MarkingFeedbackView } from "./MarkingFeedbackView";

// A marked answer: the question, the student's answer and their score. The full marking opens in
// the right panel (PRD LN-08), at once when the student has just been marked.
export function MarkedItem({
  question,
  answerText,
  feedback,
  openNow,
}: {
  question: string;
  answerText: string;
  feedback: MarkingFeedback;
  openNow: boolean;
}) {
  const panel = useRightPanel();
  const open = () => panel.open({ title: "Your marking", body: <MarkingFeedbackView feedback={feedback} /> });

  useEffect(() => {
    if (openNow) open();
    // Open once, when the page first shows a fresh marking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-medium">Question</h3>
      <p className="whitespace-pre-line text-[15px] leading-relaxed">{question}</p>
      <h3 className="font-medium">Your answer</h3>
      <p className="whitespace-pre-line rounded-xl border border-line bg-paper p-4 text-[15px] leading-relaxed">{answerText}</p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-medium">
          Score: {feedback.total} / {feedback.max}
        </p>
        <button type="button" onClick={open} className={compactSecondaryButton}>
          See the marking
        </button>
      </div>
    </li>
  );
}
