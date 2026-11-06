"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { StudyStory } from "@/server/db/study";
import { checkStoryAnswer } from "@/server/study/aids";
import { AnotherStory } from "./AnotherStory";

type Result = { correct: boolean; correctChoice: number; explanation: string | null };

// "Read it as a story" (founder's brief, Feature Two): closed until the student opens it, so the
// lesson stays calm. Everyday stories are labelled as illustrations; case stories name the case
// they retell. The quick question is marked on the server after the student chooses.
export function StoryCard({ story, authorityName }: { story: StudyStory; authorityName: string | null }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const label = story.kind === "everyday" ? "Illustration, not a real case" : `Case story${authorityName ? `: ${authorityName}` : ""}`;

  async function check(picked: number) {
    setChoice(picked);
    setBusy(true);
    setError(undefined);
    const answer = await checkStoryAnswer({ storyId: story.id, choice: picked });
    setBusy(false);
    if (!answer.ok) return setError(answer.message);
    setResult(answer);
  }

  // Closed: a card of its own (book symbol, kind and title), so it does not look like an ordinary
  // button among the lesson's other cards (founder, 2026-11-06).
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls={id}
        aria-label={`Read it as a story: ${story.title}`}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left hover:border-ink"
      >
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line">
          <Icon name="book" size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs uppercase tracking-[0.14em] text-muted">{story.kind === "everyday" ? "Story" : "Case story"}</span>
          <span className="break-words font-serif text-lg leading-snug">{story.title}</span>
        </span>
        <span aria-hidden className="shrink-0 text-sm text-muted">
          Read it ›
        </span>
      </button>
    );

  return (
    <section id={id} aria-label={`Story: ${story.title}`} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted underline underline-offset-2">
          Close
        </button>
      </div>
      <h3 className="font-serif text-xl font-normal">{story.title}</h3>
      {story.parts.map((part, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{part.heading}</span>
          <p className="text-[15px] leading-relaxed">{part.text}</p>
        </div>
      ))}
      <p className="rounded-xl border border-line px-3 py-2 text-[15px]">
        <span className="font-medium">Remember: </span>
        {story.takeaway}
      </p>
      {story.question && story.choices && (
        <fieldset className="flex flex-col gap-2" disabled={busy || result !== null}>
          <legend className="mb-1 text-[15px] font-medium">{story.question}</legend>
          {story.choices.map((text, i) => {
            const right = result && i === result.correctChoice;
            const wrong = result && i === choice && !result.correct;
            return (
              <button
                key={i}
                type="button"
                onClick={() => void check(i)}
                className={`rounded-xl border px-3 py-2 text-left text-[15px] ${right ? "border-success" : wrong ? "border-warning" : "border-line"}`}
              >
                {text}
                {right ? " ✓" : ""}
              </button>
            );
          })}
          {result && (
            <p role="status" className="text-sm">
              <span className={result.correct ? "text-success" : "text-warning"}>{result.correct ? "Correct." : "Not quite."}</span>{" "}
              {result.explanation}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-warning">
              {error}
            </p>
          )}
        </fieldset>
      )}
      <AnotherStory storyId={story.id} />
    </section>
  );
}
