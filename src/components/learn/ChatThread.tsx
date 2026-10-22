"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useRightPanel } from "@/components/shell/panelContext";
import { formatWat } from "@/lib/dates";
import type { AnswerLevel } from "@/prompts/explain";
import type { ChatMessage, ChatSource } from "@/server/db/workspace";
import { AnswerCard } from "./AnswerCard";
import { AnswerText } from "./AnswerText";
import { askQuestion, takePendingQuestion } from "./askStream";
import { FollowUpBox } from "./FollowUpBox";
import { SourcePassage } from "./SourcePassage";

type Live = { question: string; level: AnswerLevel; text: string; error?: string };

// A Learn chat: earlier messages, the answer being written now, and the next-question box.
export function ChatThread({ chatId, initialMessages }: { chatId: string; initialMessages: ChatMessage[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<AnswerLevel>("exam");
  const started = useRef(false);
  const panel = useRightPanel();
  const router = useRouter();

  function openSource(source: ChatSource) {
    panel.open({ title: `Source S${source.label}`, body: <SourcePassage key={source.id} id={source.id} /> });
  }

  async function ask(question: string, answerLevel: AnswerLevel) {
    setBusy(true);
    setLive({ question, level: answerLevel, text: "" });
    await askQuestion(chatId, question, answerLevel, (event) => {
      if (event.type === "text") {
        setLive((current) => current && { ...current, text: current.text + event.text });
      } else if (event.type === "error") {
        setLive((current) => current && { ...current, error: event.message });
      } else {
        const now = new Date().toISOString();
        setMessages((current) => [
          ...current,
          { id: `${event.messageId}-q`, role: "user", text: question, level: event.level, createdAt: now, sources: [] },
          { id: event.messageId, role: "assistant", text: event.text, level: event.level, createdAt: now, sources: event.sources },
        ]);
        setLive(null);
        router.refresh(); // Updates "questions left this month".
      }
    });
    setBusy(false);
  }

  // A question typed on the home screen (or picked from a course hub) is asked once, when its chat opens.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const pending = takePendingQuestion(chatId);
    // Starting the stream is the point of this effect: it talks to the answer route.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pending) void ask(pending, "exam");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  return (
    <div className="flex flex-col gap-6">
      {messages.length === 0 && !live && <p className="text-muted">Ask your first question below.</p>}
      <ol className="flex flex-col gap-4" aria-label="Messages">
        {messages.map((message, index) => {
          if (message.role === "user") return <Question key={message.id} text={message.text} createdAt={message.createdAt} />;
          const question = messages[index - 1]?.role === "user" ? messages[index - 1].text : null;
          return (
            <AnswerCard
              key={message.id}
              message={message}
              onOpen={openSource}
              onOtherLevel={question && !busy ? (other) => void ask(question, other) : undefined}
            />
          );
        })}
        {live && (
          <>
            <Question text={live.question} />
            <li className="flex flex-col gap-3 rounded-2xl border border-line px-4 py-3" aria-live="polite" aria-busy={!live.error}>
              <span className="sr-only">Lawdeck: </span>
              {live.text ? (
                <AnswerText text={live.text} citable={new Set()} />
              ) : (
                !live.error && <p className="text-sm text-muted">Searching the library and writing an answer…</p>
              )}
              {live.error && (
                <div role="alert" className="flex flex-col items-start gap-2 text-sm text-warning">
                  <p>{live.error}</p>
                  <button type="button" onClick={() => void ask(live.question, live.level)} className="underline underline-offset-2">
                    Try again
                  </button>
                </div>
              )}
            </li>
          </>
        )}
      </ol>
      <FollowUpBox busy={busy} level={level} onLevel={setLevel} onAsk={(question) => void ask(question, level)} />
    </div>
  );
}

function Question({ text, createdAt }: { text: string; createdAt?: string }) {
  return (
    <li className="self-end rounded-2xl bg-pill px-4 py-3 text-[15px] leading-relaxed">
      <span className="sr-only">You: </span>
      <span className="whitespace-pre-wrap break-words">{text}</span>
      {createdAt && <span className="mt-1 block text-xs text-muted">{formatWat(createdAt)}</span>}
    </li>
  );
}
