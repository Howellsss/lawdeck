"use client";

import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { saveDiaryNote } from "@/server/study/notes";

// The student's own notes on a topic (founder's brief, 20F): written, saved and revisited here.
export function DiaryNote({ topicId, initial }: { topicId: string; initial: string }) {
  const [body, setBody] = useState(initial);
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const saved = await saveDiaryNote({ topicId, body });
        setBusy(false);
        setState(saved.ok ? { tone: "ok", text: "Saved." } : { tone: "error", text: saved.message });
      }}
    >
      <label htmlFor={`note-${topicId}`} className="sr-only">
        My notes on this topic
      </label>
      <textarea
        id={`note-${topicId}`}
        rows={6}
        maxLength={20_000}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setState(null);
        }}
        placeholder="Your own notes, observations and explanations for this topic"
        className="rounded-xl border border-line bg-paper px-3 py-2 text-[15px] leading-relaxed"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={compactPrimaryButton}>
          {busy ? "Saving…" : "Save notes"}
        </button>
        {state && (
          <span role={state.tone === "error" ? "alert" : "status"} className={`text-sm ${state.tone === "error" ? "text-warning" : "text-success"}`}>
            {state.text}
          </span>
        )}
      </div>
    </form>
  );
}
