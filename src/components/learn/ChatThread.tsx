"use client";

import { useEffect, useRef, useState } from "react";
import { useRightPanel } from "@/components/shell/panelContext";
import { formatWat } from "@/lib/dates";
import type { ChatMessage, ChatSource } from "@/server/db/workspace";
import { AnswerText } from "./AnswerText";
import { askQuestion, takePendingQuestion } from "./askStream";
import { FollowUpBox } from "./FollowUpBox";
import { SourceList } from "./SourceList";
import { SourcePassage } from "./SourcePassage";

type Live = { question: string; text: string; error?: string };

// A Learn chat: earlier messages, the answer being written now, and the next-question box.
export function ChatThread({ chatId, initialMessages }: { chatId: string; initialMessages: ChatMessage[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const panel = useRightPanel();

  function openSource(source: ChatSource) {
    panel.open({ title: `Source S${source.label}`, body: <SourcePassage key={source.id} id={source.id} /> });
  }

  async function ask(question: string) {
    setBusy(true);
    setLive({ question, text: "" });
    await askQuestion(chatId, question, (event) => {
      if (event.type === "text") {
        setLive((current) => current && { ...current, text: current.text + event.text });
      } else if (event.type === "error") {
        setLive((current) => current && { ...current, error: event.message });
      } else {
        const now = new Date().toISOString();
        setMessages((current) => [
          ...current,
          { id: `${event.messageId}-q`, role: "user", text: question, createdAt: now, sources: [] },
          { id: event.messageId, role: "assistant", text: event.text, createdAt: now, sources: event.sources },
        ]);
        setLive(null);
      }
    });
    setBusy(false);
  }

  // A question typed on the home screen is asked as soon as its chat opens (once).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const pending = takePendingQuestion(chatId);
    // Starting the stream is the point of this effect: it talks to the answer route.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pending) void ask(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  return (
    <div className="flex flex-col gap-6">
      {messages.length === 0 && !live && <p className="text-muted">Ask your first question below.</p>}
      <ol className="flex flex-col gap-4" aria-label="Messages">
        {messages.map((message) => (
          <Message key={message.id} message={message} onOpen={openSource} />
        ))}
        {live && (
          <>
            <li className="self-end rounded-2xl bg-pill px-4 py-3 text-[15px] leading-relaxed">
              <span className="sr-only">You: </span>
              <span className="whitespace-pre-wrap break-words">{live.question}</span>
            </li>
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
                  <button type="button" onClick={() => void ask(live.question)} className="underline underline-offset-2">
                    Try again
                  </button>
                </div>
              )}
            </li>
          </>
        )}
      </ol>
      <FollowUpBox busy={busy} onAsk={(question) => void ask(question)} />
    </div>
  );
}

function Message({ message, onOpen }: { message: ChatMessage; onOpen: (source: ChatSource) => void }) {
  if (message.role === "user") {
    return (
      <li className="self-end rounded-2xl bg-pill px-4 py-3 text-[15px] leading-relaxed">
        <span className="sr-only">You: </span>
        <span className="whitespace-pre-wrap break-words">{message.text}</span>
        <span className="mt-1 block text-xs text-muted">{formatWat(message.createdAt)}</span>
      </li>
    );
  }
  const byLabel = new Map(message.sources.map((source) => [source.label, source]));
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line px-4 py-3">
      <span className="sr-only">Lawdeck: </span>
      <AnswerText
        text={message.text}
        citable={new Set(byLabel.keys())}
        onCite={(label) => {
          const source = byLabel.get(label);
          if (source) onOpen(source);
        }}
      />
      <SourceList sources={message.sources} onOpen={onOpen} />
      <span className="text-xs text-muted">{formatWat(message.createdAt)}</span>
    </li>
  );
}
