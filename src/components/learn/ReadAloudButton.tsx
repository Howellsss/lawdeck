"use client";

import { Icon } from "@/components/ui/Icon";
import { speaker } from "./speaker";
import { useSpeaker } from "./useSpeaker";

const pill =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm text-ink hover:bg-pill";

// "Read" on an answer (founder, 2026-10-28): reads the whole answer aloud in the student's
// chosen voice, with Pause, Resume and Stop while it plays.
export function ReadAloudButton({ messageId }: { messageId: string }) {
  const state = useSpeaker();
  const key = `${messageId}:full`;
  const mine = state.key === key;

  if (!mine || state.status === "idle" || state.status === "error")
    return (
      <span className="flex flex-col items-start gap-1">
        <button type="button" onClick={() => void speaker.play(messageId, "full")} className={pill}>
          <Icon name="speaker" size={16} />
          Read
        </button>
        {mine && state.status === "error" && (
          <span role="status" className="text-sm text-muted">
            {state.message}
          </span>
        )}
      </span>
    );

  return (
    <span className="flex items-center gap-2" role="group" aria-label="Reading aloud">
      {state.status === "paused" ? (
        <button type="button" onClick={() => speaker.resume()} className={pill}>
          <Icon name="play" size={16} />
          Resume
        </button>
      ) : (
        <button
          type="button"
          onClick={() => speaker.pause()}
          disabled={state.status === "loading"}
          className={`${pill} disabled:opacity-60`}
        >
          <Icon name="pause" size={16} />
          {state.status === "loading" ? "Preparing…" : "Pause"}
        </button>
      )}
      <button type="button" onClick={() => speaker.stop()} className={pill} aria-label="Stop reading">
        <Icon name="stop" size={16} />
        Stop
      </button>
      <span className="sr-only" aria-live="polite">
        {state.status === "playing" ? "Reading aloud" : state.status === "paused" ? "Paused" : "Preparing"}
      </span>
    </span>
  );
}
