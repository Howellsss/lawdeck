"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useRightPanel } from "@/components/shell/panelContext";
import { formatWat } from "@/lib/dates";
import type { AnswerLevel } from "@/prompts/explain";
import type { ChatMessage, ChatSource } from "@/server/db/workspace";
import { AnswerCard } from "./AnswerCard";
import { AnswerText } from "./AnswerText";
import { askQuestion, takePendingQuestion, takePendingTalk } from "./askStream";
import { FollowUpBox } from "./FollowUpBox";
import { SearchStatus } from "./SearchStatus";
import { SourcePassage } from "./SourcePassage";
import { TalkBar, TalkButton } from "./TalkBar";
import { useTalkMode, type Answered } from "./useTalkMode";

type Live = {
  question: string;
  level: AnswerLevel;
  text: string;
  // Passages the library search found; unset while it is still searching.
  found?: number;
  error?: string;
  // The student pressed Stop: what was written so far stays on screen, and is not saved.
  stopped?: boolean;
};

// A Learn chat: earlier messages, the answer being written now, and the next-question box.
export function ChatThread({
  chatId,
  initialMessages,
  voice = false,
}: {
  chatId: string;
  initialMessages: ChatMessage[];
  // Whether Lawdeck's voice is set up (Read buttons and voice mode).
  voice?: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<AnswerLevel>("exam");
  const started = useRef(false);
  const stopper = useRef<AbortController | null>(null);
  const panel = useRightPanel();
  const router = useRouter();

  function openSource(source: ChatSource) {
    const from =
      source.origin === "upload"
        ? "From your uploads"
        : "From the Lawdeck library";
    panel.open({
      title: `Passage · ${from}`,
      body: (
        <SourcePassage key={source.id} id={source.id} origin={source.origin} />
      ),
    });
  }

  // Stop (founder, 2026-10-25): ends the search or the answer at once; the server stops the AI too.
  function stop() {
    stopper.current?.abort();
  }

  // Returns the saved answer, or null when it was stopped or failed (voice mode reads it aloud).
  async function ask(question: string, answerLevel: AnswerLevel): Promise<Answered> {
    let answered: Answered = null;
    const controller = new AbortController();
    stopper.current = controller;
    setBusy(true);
    setLive({ question, level: answerLevel, text: "" });
    await askQuestion(chatId, question, answerLevel, (event) => {
      if (event.type === "found") {
        setLive((current) => current && { ...current, found: event.count });
      } else if (event.type === "text") {
        setLive(
          (current) =>
            current && { ...current, text: current.text + event.text },
        );
      } else if (event.type === "error") {
        setLive((current) => current && { ...current, error: event.message });
      } else {
        const now = new Date().toISOString();
        setMessages((current) => [
          ...current,
          {
            id: `${event.messageId}-q`,
            role: "user",
            text: question,
            level: event.level,
            createdAt: now,
            sources: [],
          },
          {
            id: event.messageId,
            role: "assistant",
            text: event.text,
            level: event.level,
            createdAt: now,
            sources: event.sources,
          },
        ]);
        answered = { id: event.messageId, text: event.text };
        setLive(null);
        router.refresh(); // Updates "questions left this month".
      }
    }, controller.signal);
    if (controller.signal.aborted) {
      setLive((current) => current && { ...current, stopped: true });
      router.refresh(); // A stopped question still counts towards the limit.
    }
    stopper.current = null;
    setBusy(false);
    return answered;
  }

  // Voice mode answers in the spoken Conversation style, whatever level the box is set to.
  const talk = useTalkMode((question) => ask(question, "talk"));

  // A question typed on the home screen (or picked from a course hub) is asked once, when its chat opens.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const pending = takePendingQuestion(chatId);
    // Starting the stream (or voice mode) is the point of this effect: it talks to the answer route.
    if (pending && voice && takePendingTalk(chatId)) talk.begin(pending);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (pending) void ask(pending, "exam");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  return (
    <div className="flex flex-col gap-6">
      {messages.length === 0 && !live && (
        <p className="text-muted">Ask your first question below.</p>
      )}
      <ol className="flex flex-col gap-4" aria-label="Messages">
        {messages.map((message, index) => {
          if (message.role === "user")
            return (
              <Question
                key={message.id}
                text={message.text}
                createdAt={message.createdAt}
              />
            );
          const question =
            messages[index - 1]?.role === "user"
              ? messages[index - 1].text
              : null;
          return (
            <AnswerCard
              key={message.id}
              message={message}
              canRead={voice}
              onOpen={openSource}
              onOtherLevel={
                question && !busy
                  ? (other) => void ask(question, other)
                  : undefined
              }
            />
          );
        })}
        {live && (
          <>
            <Question text={live.question} />
            <li
              className="flex flex-col gap-3 rounded-2xl border border-line px-4 py-3"
              aria-live="polite"
              aria-busy={!live.error && !live.stopped}
            >
              <span className="sr-only">Lawdeck: </span>
              {!live.error && !live.stopped && <SearchStatus found={live.found} writing={Boolean(live.text)} />}
              {live.text && <AnswerText text={live.text} citable={new Set()} markers="links" />}
              {live.stopped && (
                <div role="status" className="flex flex-col items-start gap-2 text-sm text-muted">
                  <p>Stopped. {live.text ? "This part answer is not saved." : "Nothing was written."}</p>
                  <button
                    type="button"
                    onClick={() => void ask(live.question, live.level)}
                    className="text-ink underline underline-offset-2"
                  >
                    Ask again
                  </button>
                </div>
              )}
              {live.error && (
                <div
                  role="alert"
                  className="flex flex-col items-start gap-2 text-sm text-warning"
                >
                  <p>{live.error}</p>
                  <button
                    type="button"
                    onClick={() => void ask(live.question, live.level)}
                    className="underline underline-offset-2"
                  >
                    Try again
                  </button>
                </div>
              )}
            </li>
          </>
        )}
      </ol>
      <TalkBar talk={talk.talk} onInterrupt={talk.interrupt} onEnd={talk.end} />
      {talk.note && (
        <p role="status" className="px-1 text-sm text-muted">
          {talk.note}
        </p>
      )}
      <FollowUpBox
        busy={busy}
        talkButton={
          voice && talk.talk === "off" ? <TalkButton disabled={busy} onClick={() => talk.begin()} /> : undefined
        }
        level={level}
        onLevel={setLevel}
        onAsk={(question) => void ask(question, level)}
        onStop={stop}
      />
    </div>
  );
}

function Question({ text, createdAt }: { text: string; createdAt?: string }) {
  return (
    <li className="self-end rounded-2xl bg-pill px-4 py-3 text-[15px] leading-relaxed">
      <span className="sr-only">You: </span>
      <span className="whitespace-pre-wrap break-words">{text}</span>
      {createdAt && (
        <span className="mt-1 block text-xs text-muted">
          {formatWat(createdAt)}
        </span>
      )}
    </li>
  );
}
