import { AnswerText } from "@/components/learn/AnswerText";
import { LEVEL_LABELS } from "@/prompts/explain";
import { formatWat } from "@/lib/dates";
import type { SharedMessage, SharedSource } from "@/server/db/sharing";

const ORIGIN = { library: "From the Lawdeck library", upload: "From the student’s uploads" } as const;

// A chat in a shared project, read-only: questions, answers and the titles of their sources
// (the passages themselves stay private to the owner).
export function SharedChatView({ messages }: { messages: SharedMessage[] }) {
  if (messages.length === 0) return <p className="text-muted">This chat has no messages yet.</p>;
  return (
    <ol className="flex flex-col gap-4" aria-label="Messages">
      {messages.map((message, index) =>
        message.role === "user" ? (
          <li key={index} className="self-end rounded-2xl bg-pill px-4 py-3 text-[15px] leading-relaxed">
            <span className="sr-only">Student: </span>
            <span className="whitespace-pre-wrap break-words">{message.text}</span>
            <span className="mt-1 block text-xs text-muted">{formatWat(message.createdAt)}</span>
          </li>
        ) : (
          <li key={index} className="flex flex-col gap-3 rounded-2xl border border-line px-4 py-3">
            <span className="sr-only">Lawdeck: </span>
            {message.level && <span className="text-xs font-medium uppercase tracking-wide text-muted">{LEVEL_LABELS[message.level]}</span>}
            <AnswerText text={message.text} citable={new Set()} />
            <Sources sources={message.sources} />
            <span className="text-xs text-muted">{formatWat(message.createdAt)}</span>
          </li>
        ),
      )}
    </ol>
  );
}

function Sources({ sources }: { sources: SharedSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Sources</p>
      <ul className="flex flex-col gap-1 text-sm">
        {sources.map((source) => (
          <li key={source.label} className="break-words">
            S{source.label} · {source.title} <span className="text-muted">({ORIGIN[source.origin]})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
