"use client";

import { useState } from "react";
import { setChatUsesUploads } from "@/server/learn/actions";

// "Use my uploads" for this chat (step 6c): on, answers also draw on the student's own Ready
// files; off, the library only. Saved on the chat.
export function UseUploadsSwitch({
  chatId,
  initial,
}: {
  chatId: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function toggle() {
    const next = !on;
    setBusy(true);
    setMessage(undefined);
    const result = await setChatUsesUploads(chatId, next);
    setBusy(false);
    if (result.ok) setOn(next);
    else setMessage(result.message);
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy}
        onClick={() => void toggle()}
        className="inline-flex min-h-11 items-center gap-3 self-start rounded-full border border-line px-4 text-sm"
      >
        <span
          aria-hidden
          className={`relative h-5 w-9 rounded-full ring-1 ring-muted transition-colors ${on ? "bg-ink" : "bg-pill"}`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-paper transition-all ${on ? "left-[18px]" : "left-0.5"}`}
          />
        </span>
        Use my uploads
      </button>
      <p className="text-xs text-muted">
        {on
          ? "Answers can also draw on your own uploaded notes, labelled “From your uploads”."
          : "Answers use the Lawdeck library only."}
      </p>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
