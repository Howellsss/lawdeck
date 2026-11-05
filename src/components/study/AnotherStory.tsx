"use client";

import { useState } from "react";
import { anotherStory, type MadeStory } from "@/server/study/again";

// "Tell it another way" (founder's brief: "request another version of a story if the first
// explanation is difficult to understand"): the same point, told differently, made on request and
// checked against the library. Uses one question.
export function AnotherStory({ storyId }: { storyId: string }) {
  const [made, setMade] = useState<MadeStory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function make() {
    setBusy(true);
    setError(undefined);
    const result = await anotherStory({ storyId });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setMade(result.story);
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      {made && (
        <section aria-label={`Told another way: ${made.title}`} className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            Told another way{made.kind === "everyday" ? " · illustration, not a real case" : ""}
          </p>
          <h4 className="font-serif text-lg font-normal">{made.title}</h4>
          {made.parts.map((part, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{part.heading}</span>
              <p className="text-[15px] leading-relaxed">{part.text}</p>
            </div>
          ))}
          <p className="text-[15px]">
            <span className="font-medium">Remember: </span>
            {made.takeaway}
          </p>
        </section>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" disabled={busy} onClick={() => void make()} className="text-muted underline underline-offset-2 disabled:opacity-60">
          {busy ? "Telling it another way…" : made ? "Tell it yet another way" : "Tell it another way"}
        </button>
        <span className="text-muted">uses one question</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      )}
    </div>
  );
}
