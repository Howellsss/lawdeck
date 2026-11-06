"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage, ChatPerson, WeekTopic } from "@/server/chat/data";
import { deleteMessage, loadMessages, markRead, sendMessage } from "@/server/chat/actions";
import { hideMessage } from "@/server/chat/moderation";
import type { CallStatus } from "@/server/chat/calls";
import { createPoll } from "@/server/chat/polls";
import { setWeekTopic, shareLesson } from "@/server/chat/together";
import { ChatComposer, type Attached } from "./ChatComposer";
import { CallBar } from "./call/CallBar";
import { ChatMessages } from "./ChatMessages";
import { PollDialog, type PollDraft } from "./PollDialog";
import { ShareLessonDialog } from "./ShareLessonDialog";
import { usePollRefresh } from "./usePollRefresh";
import { WeekTopicBar } from "./WeekTopicBar";

const CHECK_EVERY = 4000;

// One open group: its messages, checked for new ones every few seconds while the page is in view,
// and the message box. Study groups show "This week's topic" at the top. Scrolls to the newest message unless the student has scrolled up to read.
export function ChatRoom({
  groupId,
  groupName,
  welcome,
  initial,
  initialHasOlder,
  isAdmin = false,
  voiceNotes = false,
  apiKey,
  studyGroup = false,
  canSetWeekTopic = false,
  initialWeekTopic = null,
  calls = false,
  initialCall = null,
}: {
  groupId: string;
  groupName: string;
  welcome?: string;
  initial: ChatMessage[];
  initialHasOlder: boolean;
  isAdmin?: boolean;
  voiceNotes?: boolean;
  apiKey: string;
  studyGroup?: boolean;
  canSetWeekTopic?: boolean;
  initialWeekTopic?: WeekTopic | null;
  // Study groups, once LiveKit is set up: the call line at the top.
  calls?: boolean;
  initialCall?: CallStatus;
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
  const [picking, setPicking] = useState<"share" | "week" | "poll" | null>(null);
  const [pickError, setPickError] = useState<string>();
  const [pickBusy, setPickBusy] = useState(false);
  const [weekTopic, setWeek] = useState(initialWeekTopic);

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

  const setPoll = usePollRefresh(messages, setMessages);

  const makePoll = async (draft: PollDraft) => {
    setPickBusy(true);
    setPickError(undefined);
    const result = await createPoll({ groupId, ...draft });
    setPickBusy(false);
    if (!result.ok) return setPickError(result.message);
    stick.current = true;
    merge([result.message]);
    setPicking(null);
  };

  const pick = async (topicId: string, note: string) => {
    setPickBusy(true);
    setPickError(undefined);
    if (picking === "week") {
      const result = await setWeekTopic({ groupId, topicId });
      setPickBusy(false);
      if (!result.ok) return setPickError(result.message);
      setWeek(result.weekTopic);
    } else {
      const result = await shareLesson({ groupId, topicId, note });
      setPickBusy(false);
      if (!result.ok) return setPickError(result.message);
      stick.current = true;
      merge([result.message]);
    }
    setPicking(null);
  };

  const clearWeek = async () => {
    setPickBusy(true);
    const result = await setWeekTopic({ groupId, topicId: null });
    setPickBusy(false);
    if (!result.ok) return setError(result.message);
    setWeek(null);
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
      {calls && <CallBar groupId={groupId} initialStatus={initialCall} />}
      {studyGroup && <WeekTopicBar weekTopic={weekTopic} canSet={canSetWeekTopic} busy={pickBusy} onSet={() => (setPickError(undefined), setPicking("week"))} onClear={() => void clearWeek()} />}
      <div ref={scroller} onScroll={() => atBottom() && unseen > 0 && setUnseen(0)} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="mt-auto" />
        <ChatMessages messages={messages} hasOlder={hasOlder} loadingOlder={loadingOlder} onOlder={() => void older()} onDelete={(id) => void remove(id)} onHide={(id) => void hide(id)} onPoll={setPoll} isAdmin={isAdmin} groupName={groupName} welcome={welcome} />
      </div>
      {unseen > 0 && (
        <button type="button" onClick={toBottom} className="absolute bottom-[132px] left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-[13px] font-medium text-on-ink shadow-md">
          {unseen} new message{unseen === 1 ? "" : "s"} ↓
        </button>
      )}
      <ChatComposer
        groupId={groupId}
        groupName={groupName}
        apiKey={apiKey}
        voiceNotes={voiceNotes}
        onShareLesson={() => (setPickError(undefined), setPicking("share"))}
        onPoll={() => (setPickError(undefined), setPicking("poll"))}
        onSend={send}
        error={error}
      />
      {picking === "poll" && <PollDialog studyGroup={studyGroup} busy={pickBusy} error={pickError} onCreate={(d) => void makePoll(d)} onClose={() => setPicking(null)} />}
      {picking && picking !== "poll" && <ShareLessonDialog mode={picking} busy={pickBusy} error={pickError} onPick={(t, n) => void pick(t, n)} onClose={() => setPicking(null)} />}
    </div>
  );
}
