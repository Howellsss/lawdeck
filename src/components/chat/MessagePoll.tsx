"use client";

import { useState } from "react";
import type { ChatPoll } from "@/server/chat/data";
import { closePoll, votePoll } from "@/server/chat/polls";
import { PollCard } from "./PollCard";

// A poll message: votes and closing go to the server, and the fresh poll goes back to the room.
export function MessagePoll({ messageId, question, poll, onPoll }: { messageId: string; question: string; poll: ChatPoll; onPoll: (messageId: string, poll: ChatPoll) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const act = async (run: () => Promise<{ ok: true; poll: ChatPoll | null } | { ok: false; message: string }>) => {
    setBusy(true);
    setError(undefined);
    const result = await run();
    setBusy(false);
    if (!result.ok) return setError(result.message);
    if (result.poll) onPoll(messageId, result.poll);
  };
  return (
    <PollCard
      question={question}
      poll={poll}
      busy={busy}
      error={error}
      onVote={(choice) => choice !== poll.myChoice && void act(() => votePoll({ messageId, pollId: poll.id, choice }))}
      onClose={() => void act(() => closePoll({ messageId, pollId: poll.id }))}
    />
  );
}
