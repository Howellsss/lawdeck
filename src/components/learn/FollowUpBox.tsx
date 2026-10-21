"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";

// The box for the next question in a chat.
export function FollowUpBox({ busy, onAsk }: { busy: boolean; onAsk: (question: string) => void }) {
  const [text, setText] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !text.trim()) return;
    onAsk(text.trim());
    setText("");
  }

  return (
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
      <button
        type="submit"
        disabled={busy || !text.trim()}
        aria-label="Send"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink disabled:opacity-40"
      >
        <Icon name="arrowUp" size={18} />
      </button>
    </form>
  );
}
