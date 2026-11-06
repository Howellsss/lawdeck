"use client";

import { useState } from "react";
import { watTime } from "@/lib/chatTime";
import type { ChatMessage } from "@/server/chat/data";
import { ChatBody } from "./ChatBody";
import { ChatFiles } from "./ChatFiles";
import { LessonCard } from "./LessonCard";
import { MessageActions } from "./MessageActions";
import { ReportForm } from "./ReportForm";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "L") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

// One message, Slack-style: avatar, name, campus and time on the first message of a run; later
// messages in the run show only the time on hover. Files show under the text. The author can delete
// their own message; others can report it; admins can hide it.
export function ChatMessageItem({
  message,
  first,
  isAdmin,
  onDelete,
  onHide,
}: {
  message: ChatMessage;
  first: boolean;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onHide: (id: string) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
        {message.body.trim() && <ChatBody body={message.body} />}
        {message.lesson && <LessonCard card={message.lesson} />}
        <ChatFiles files={message.files} />
        {reporting && <ReportForm messageId={message.id} onDone={(sent) => (setReporting(false), setNotice(sent))} />}
        {notice && (
          <p role="status" className="mt-1 text-[13px] text-muted">
            {notice}
          </p>
        )}
      </div>
      <MessageActions mine={message.mine} isAdmin={isAdmin} onDelete={() => onDelete(message.id)} onHide={() => onHide(message.id)} onReport={() => (setReporting(true), setNotice(null))} />
    </li>
  );
}
