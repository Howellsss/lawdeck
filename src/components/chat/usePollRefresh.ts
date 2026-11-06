"use client";

import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { ChatMessage, ChatPoll } from "@/server/chat/data";
import { refreshPolls } from "@/server/chat/polls";

const CHECK_EVERY = 6000;

// Keeps the open polls on screen up to date (one check every few seconds while the page is in
// view) and returns a setter for a poll just voted on or closed.
export function usePollRefresh(messages: ChatMessage[], setMessages: Dispatch<SetStateAction<ChatMessage[]>>) {
  const setPoll = useCallback(
    (messageId: string, poll: ChatPoll) => setMessages((list) => list.map((m) => (m.id === messageId ? { ...m, poll } : m))),
    [setMessages],
  );
  const open = messages
    .filter((m) => m.poll && !m.poll.closed)
    .map((m) => m.id)
    .slice(-100)
    .join(",");
  useEffect(() => {
    if (!open) return;
    const ids = open.split(",");
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const fresh = await refreshPolls({ messageIds: ids });
      setMessages((list) => list.map((m) => (fresh[m.id] ? { ...m, poll: fresh[m.id] } : m)));
    }, CHECK_EVERY);
    return () => window.clearInterval(timer);
  }, [open, setMessages]);
  return setPoll;
}
