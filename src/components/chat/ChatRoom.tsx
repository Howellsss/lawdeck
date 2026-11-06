"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage, ChatPerson } from "@/server/chat/data";
import { deleteMessage, loadMessages, markRead, sendMessage } from "@/server/chat/actions";
import { hideMessage } from "@/server/chat/moderation";
import { ChatComposer, type Attached } from "./ChatComposer";
import { ChatMessages } from "./ChatMessages";

const CHECK_EVERY = 4000;

// One open group: its messages, checked for new ones every few seconds while the page is in view,
// and the message box. Scrolls to the newest message unless the student has scrolled up to read.
export function ChatRoom({
  groupId,
  groupName,
  initial,
  initialHasOlder,
  isAdmin = false,
  apiKey,
}: {
  groupId: string;
  groupName: string;
  initial: ChatMessage[];
  initialHasOlder: boolean;
  isAdmin?: boolean;
  apiKey: string;
}) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState(initial);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string>();
  const [unseen, setUnseen] = useState(0);
  const stick = useRef(true);
  const keepOffset = useRef<number | null>(null);

  const atBottom = () => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  const toBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    setUnseen(0);
  };

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const merge = useCallback((more: ChatMessage[]) => {
    if (more.length === 0) return;
    setMessages((list) => {
      const seen = new Set(list.map((m) => m.id));
      return [...list, ...more.filter((m) => !seen.has(m.id))];
    });
  }, []);

  // New messages from others, while the page is in view; the group counts as read when seen.
  useEffect(() => {
    void markRead({ groupId });
    let last = initial.at(-1)?.createdAt;
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const result = await loadMessages(last ? { groupId, after: last } : { groupId });
      if (!result.ok || result.messages.length === 0) return;
      last = result.messages.at(-1)?.createdAt ?? last;
      stick.current = atBottom();
      if (!stick.current) setUnseen((n) => n + result.messages.filter((m) => !m.mine).length);
      merge(result.messages);
      void markRead({ groupId });
    }, CHECK_EVERY);
    // Unread counts in the group list are refreshed now and then.
    const counts = window.setInterval(() => document.visibilityState === "visible" && router.refresh(), 30_000);
    return () => (window.clearInterval(timer), window.clearInterval(counts));
  }, [groupId, initial, merge, router]);

  const send = async (text: string, picked: ChatPerson[], files: Attached[]) => {
    setError(undefined);
    const result = await sendMessage({ groupId, text, picked: picked.map((p) => ({ id: p.id, name: p.name })), files });
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    stick.current = true;
    merge([result.message]);
    return true;
  };

  const older = async () => {
    const first = messages[0];
    if (!first) return;
    setLoadingOlder(true);
    const result = await loadMessages({ groupId, before: first.createdAt });
    setLoadingOlder(false);
    if (!result.ok) return setError(result.message);
    keepOffset.current = (scroller.current?.scrollHeight ?? 0) - (scroller.current?.scrollTop ?? 0);
    setHasOlder(result.hasOlder);
    setMessages((list) => [...result.messages.filter((m) => !list.some((x) => x.id === m.id)), ...list]);
  };

  const remove = async (id: string) => {
    const result = await deleteMessage({ id });
    if (!result.ok) return setError(result.message);
    setMessages((list) => list.filter((m) => m.id !== id));
  };

  const hide = async (id: string) => {
    const result = await hideMessage({ id, hide: true });
    if (!result.ok) return setError(result.message);
    setMessages((list) => list.filter((m) => m.id !== id));
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scroller} onScroll={() => atBottom() && unseen > 0 && setUnseen(0)} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="mt-auto" />
        <ChatMessages messages={messages} hasOlder={hasOlder} loadingOlder={loadingOlder} onOlder={() => void older()} onDelete={(id) => void remove(id)} onHide={(id) => void hide(id)} isAdmin={isAdmin} groupName={groupName} />
      </div>
      {unseen > 0 && (
        <button type="button" onClick={toBottom} className="absolute bottom-[132px] left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-[13px] font-medium text-on-ink shadow-md">
          {unseen} new message{unseen === 1 ? "" : "s"} ↓
        </button>
      )}
      <ChatComposer groupId={groupId} groupName={groupName} apiKey={apiKey} onSend={send} error={error} />
    </div>
  );
}
