"use client";

import { dayLabel, watDay, watTime } from "@/lib/chatTime";
import type { ChatPoll } from "@/server/chat/data";

// A poll in a message: the question and a button per choice. After voting (or once it closes) each
// choice shows its votes as a bar; names show only when the maker chose to show them. The vote can
// be changed until the poll closes; its maker can close it early.
export function PollCard({
  question,
  poll,
  busy,
  error,
  onVote,
  onClose,
}: {
  question: string;
  poll: ChatPoll;
  busy: boolean;
  error?: string;
  onVote: (choice: number) => void;
  onClose: () => void;
}) {
  const results = poll.total !== null;
  const total = poll.total ?? 0;
  return (
    <div role="group" aria-label={`Poll: ${question}`} className="mt-1 flex max-w-md flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <p className="text-[12px] text-muted">📊 Poll · {poll.showNames ? "names shown" : "anonymous"}</p>
      <p className="text-[15px] font-semibold break-words">{question}</p>
      <ul className="flex flex-col gap-1.5">
        {poll.choices.map((c, i) => {
          const picked = poll.myChoice === i;
          const share = results && total > 0 ? Math.round(((c.votes ?? 0) / total) * 100) : 0;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onVote(i)}
                disabled={busy || poll.closed}
                aria-pressed={picked}
                className={`relative flex min-h-11 w-full items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 text-left text-[15px] disabled:cursor-default ${
                  picked ? "border-ink" : "border-line hover:bg-pill"
                }`}
              >
                {results && <span aria-hidden className="absolute inset-y-0 left-0 bg-pill" style={{ width: `${share}%` }} />}
                <span className="relative min-w-0 flex-1 break-words">
                  {picked && <span aria-hidden>✓ </span>}
                  {c.label}
                </span>
                {results && (
                  <span className="relative shrink-0 text-[13px] text-muted">
                    {c.votes} · {share}%
                  </span>
                )}
              </button>
              {c.voters && c.voters.length > 0 && <p className="px-1 pt-0.5 text-[12px] text-muted">{c.voters.join(", ")}</p>}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-[13px] text-warning">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
        <p>
          {results ? `${total} vote${total === 1 ? "" : "s"}` : "Vote to see the results"} ·{" "}
          {poll.closed ? "Closed" : `Closes ${dayLabel(watDay(poll.closesAt))}, ${watTime(poll.closesAt)}`}
          {!poll.closed && poll.myChoice !== null && " · tap another choice to change your vote"}
        </p>
        {poll.mine && !poll.closed && (
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-8 items-center rounded-full border border-line px-3 text-[13px] font-medium text-ink hover:bg-pill">
            Close poll
          </button>
        )}
      </div>
    </div>
  );
}
