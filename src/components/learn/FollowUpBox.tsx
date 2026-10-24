"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { LEVEL_LABELS, type AnswerLevel } from "@/prompts/explain";
import { VoiceButton } from "./VoiceButton";

// The box for the next question in a chat, with the answer level (PRD LN-02).
export function FollowUpBox({
  busy,
  level,
  onLevel,
  onAsk,
}: {
  busy: boolean;
  level: AnswerLevel;
  onLevel: (level: AnswerLevel) => void;
  onAsk: (question: string) => void;
}) {
  const [text, setText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !text.trim()) return;
    onAsk(text.trim());
    setText("");
  }

  return (
    <div className="flex flex-col gap-2">
      <fieldset className="flex items-center gap-2 px-1">
        <legend className="sr-only">Answer level</legend>
        {(Object.keys(LEVEL_LABELS) as AnswerLevel[]).map((value) => (
          <label
            key={value}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
              level === value
                ? "border-ink bg-ink text-on-ink"
                : "border-line text-ink"
            }`}
          >
            <input
              type="radio"
              name="answer-level"
              value={value}
              checked={level === value}
              onChange={() => onLevel(value)}
              className="sr-only"
            />
            {LEVEL_LABELS[value]}
          </label>
        ))}
      </fieldset>
      <form
        onSubmit={submit}
        className="flex items-end gap-2 rounded-3xl border border-line bg-surface p-2 has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-ink"
      >
        <label htmlFor="follow-up" className="sr-only">
          Ask a follow-up question
        </label>
        <textarea
          id="follow-up"
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) submit(event);
          }}
          placeholder="Ask a follow-up question"
          className="flex-1 resize-none bg-transparent px-3 py-2 text-[16px] leading-relaxed text-ink outline-none placeholder:text-muted"
        />
        <VoiceButton
          disabled={busy}
          onText={(words) => {
            setVoiceError(null);
            setText(words);
          }}
          onError={setVoiceError}
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Send"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink disabled:opacity-40"
        >
          <Icon name="arrowUp" size={18} />
        </button>
      </form>
      {voiceError && (
        <p role="status" className="px-1 text-sm text-muted">
          {voiceError}
        </p>
      )}
    </div>
  );
}
