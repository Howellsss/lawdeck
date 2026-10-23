import { LEVEL_LABELS, type AnswerLevel } from "@/prompts/explain";
import { formatWat } from "@/lib/dates";
import type { ChatMessage, ChatSource } from "@/server/db/workspace";
import { AnswerText } from "./AnswerText";
import { SourceList } from "./SourceList";

// One saved answer: its level, text, sources, and a button to ask again at the other level.
export function AnswerCard({
  message,
  onOpen,
  onOtherLevel,
}: {
  message: ChatMessage;
  onOpen: (source: ChatSource) => void;
  // Missing when there is no question to ask again, or an answer is being written.
  onOtherLevel?: (level: AnswerLevel) => void;
}) {
  const byLabel = new Map(
    message.sources.map((source) => [source.label, source]),
  );
  const other: AnswerLevel = message.level === "simple" ? "exam" : "simple";
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line px-4 py-3">
      <span className="sr-only">Lawdeck: </span>
      {message.level && (
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {LEVEL_LABELS[message.level]}
        </span>
      )}
      <AnswerText
        text={message.text}
        citable={new Set(byLabel.keys())}
        onCite={(label) => {
          const source = byLabel.get(label);
          if (source) onOpen(source);
        }}
      />
      <SourceList sources={message.sources} onOpen={onOpen} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">
          {formatWat(message.createdAt)}
        </span>
        {onOtherLevel && (
          <button
            type="button"
            onClick={() => onOtherLevel(other)}
            className="text-sm underline underline-offset-2"
          >
            {other === "simple" ? "Explain more simply" : "Make it exam-ready"}
          </button>
        )}
      </div>
    </li>
  );
}
