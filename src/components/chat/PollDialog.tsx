"use client";

import { useEffect, useId, useRef, useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/Icon";

export type PollDraft = { question: string; choices: string[]; days: 1 | 3 | 7; showNames: boolean };

const field = "h-11 rounded-lg border border-line bg-surface px-3 text-[16px] font-normal";

// Making a poll: a question, 2 to 6 choices, how long it stays open, and (study groups only)
// whether names are shown.
export function PollDialog({
  studyGroup,
  busy,
  error,
  onCreate,
  onClose,
}: {
  studyGroup: boolean;
  busy: boolean;
  error?: string;
  onCreate: (poll: PollDraft) => void;
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState(["", ""]);
  const [days, setDays] = useState<1 | 3 | 7>(1);
  const [showNames, setShowNames] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const filled = choices.filter((c) => c.trim()).length;
  const setChoice = (i: number, v: string) => setChoices((list) => list.map((c, j) => (j === i ? v : c)));

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-32px))] rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <form
        onSubmit={(e) => (e.preventDefault(), onCreate({ question: question.trim(), choices: choices.map((c) => c.trim()).filter(Boolean), days, showNames: studyGroup && showNames }))}
        className="flex flex-col gap-4 p-5"
      >
        <div className="flex items-center justify-between">
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            Make a poll
          </h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink">
            <Icon name="close" size={18} />
          </button>
        </div>
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          Question
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} required autoFocus className={field} />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1.5 text-[15px] font-medium">Choices (2 to 6)</legend>
          {choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={c} onChange={(e) => setChoice(i, e.target.value)} maxLength={80} aria-label={`Choice ${i + 1}`} className={`${field} min-w-0 flex-1`} />
              {choices.length > 2 && (
                <button
                  type="button"
                  onClick={() => setChoices((list) => list.filter((_, j) => j !== i))}
                  aria-label={`Remove choice ${i + 1}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-pill hover:text-ink"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          ))}
          {choices.length < 6 && (
            <button type="button" onClick={() => setChoices((list) => [...list, ""])} className="w-fit text-[14px] font-medium underline underline-offset-4">
              Add a choice
            </button>
          )}
        </fieldset>
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          Closes after
          <select value={days} onChange={(e) => setDays(Number(e.target.value) as 1 | 3 | 7)} className={`${field} px-2`}>
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>1 week</option>
          </select>
        </label>
        {studyGroup ? (
          <label className="flex items-start gap-2 text-[15px]">
            <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} className="mt-1 size-4" />
            <span>
              Show who voted for each choice
              <span className="block text-[13px] text-muted">Otherwise votes are anonymous: everyone sees only the numbers.</span>
            </span>
          </label>
        ) : (
          <p className="text-[13px] text-muted">Votes are anonymous: everyone sees only the numbers.</p>
        )}
        {error && (
          <p role="alert" className="text-[14px] text-warning">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className={compactSecondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !question.trim() || filled < 2} className={compactPrimaryButton}>
            {busy ? "Posting…" : "Post poll"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
