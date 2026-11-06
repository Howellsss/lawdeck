"use client";

import { useState } from "react";
import { watTime } from "@/lib/chatTime";
import type { ChatMessage } from "@/server/chat/data";
import { ChatBody } from "./ChatBody";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "L") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

// One message, Slack-style: avatar, name, campus and time on the first message of a run; later
// messages in the run show only the time on hover. The author can delete their own message.
export function ChatMessageItem({ message, first, onDelete }: { message: ChatMessage; first: boolean; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className={`group relative flex gap-3 px-4 hover:bg-surface/60 lg:px-6 ${first ? "pt-2.5 pb-1" : "py-0.5"}`}>
      <div className="w-9 shrink-0">
        {first ? (
          <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-pill text-[13px] font-semibold">
            {initials(message.author.name)}
          </span>
        ) : (
          <span className="invisible block pt-1 text-right text-[11px] text-muted group-hover:visible">{watTime(message.createdAt).replace(/ [AP]M$/, "")}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {first && (
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[15px] font-semibold">{message.author.name}</span>
            {message.author.campus && <span className="rounded border border-line px-1.5 text-[11px] leading-[18px] text-muted">{message.author.campus}</span>}
            <time dateTime={message.createdAt} className="text-[12px] text-muted">
              {watTime(message.createdAt)}
            </time>
          </p>
        )}
        <ChatBody body={message.body} />
      </div>
      {message.mine && (
        <div className="absolute right-3 top-1 hidden items-center gap-2 rounded-lg border border-line bg-paper px-2 py-1 text-[12px] shadow-sm group-hover:flex group-focus-within:flex">
          {confirming ? (
            <>
              <button type="button" onClick={() => onDelete(message.id)} className="text-warning underline underline-offset-2">
                Delete for everyone
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="text-muted underline underline-offset-2">
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="text-muted underline underline-offset-2" aria-label="Delete this message">
              Delete
            </button>
          )}
        </div>
      )}
    </li>
  );
}
