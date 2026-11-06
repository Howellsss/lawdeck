"use client";

import { Fragment } from "react";
import { dayLabel, startsRun, watDay } from "@/lib/chatTime";
import type { ChatMessage } from "@/server/chat/data";
import { ChatMessageItem } from "./ChatMessageItem";

// The messages of a group, oldest at the top, with a day marker ("Today", "Yesterday", a date) where
// the day changes, as in Slack.
export function ChatMessages({
  messages,
  hasOlder,
  loadingOlder,
  onOlder,
  onDelete,
  onHide,
  isAdmin,
  groupName,
  welcome = groupName,
}: {
  messages: ChatMessage[];
  hasOlder: boolean;
  loadingOlder: boolean;
  onOlder: () => void;
  onDelete: (id: string) => void;
  onHide: (id: string) => void;
  isAdmin: boolean;
  groupName: string;
  welcome?: string;
}) {
  if (messages.length === 0)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-16 text-center">
        <p className="font-serif text-2xl">Welcome to {welcome}</p>
        <p className="max-w-md text-[15px] text-muted">No messages yet. Say hello, ask a question about a topic, or share a tip from class.</p>
      </div>
    );
  return (
    <ol aria-label={`Messages in ${groupName}`} className="flex flex-col pb-2">
      {hasOlder && (
        <li className="flex justify-center py-3">
          <button type="button" onClick={onOlder} disabled={loadingOlder} className="rounded-full border border-line px-3 py-1 text-[13px] text-muted hover:text-ink">
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        </li>
      )}
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || watDay(prev.createdAt) !== watDay(m.createdAt);
        const first = newDay || startsRun(prev && { authorId: prev.author.id, createdAt: prev.createdAt }, { authorId: m.author.id, createdAt: m.createdAt });
        return (
          <Fragment key={m.id}>
            {newDay && (
              <li role="separator" aria-label={dayLabel(watDay(m.createdAt))} className="relative my-2 flex justify-center">
                <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <span className="relative rounded-full border border-line bg-paper px-3 py-0.5 text-[12px] font-medium">{dayLabel(watDay(m.createdAt))}</span>
              </li>
            )}
            <ChatMessageItem message={m} first={first} isAdmin={isAdmin} onDelete={onDelete} onHide={onHide} />
          </Fragment>
        );
      })}
    </ol>
  );
}
