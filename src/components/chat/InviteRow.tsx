"use client";

import { useState } from "react";
import type { ChatInvite } from "@/server/chat/data";
import { answerInvite } from "@/server/chat/groups";

// An invitation to a study group, with Join and Decline.
export function InviteRow({ invite }: { invite: ChatInvite }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const answer = async (accept: boolean) => {
    setBusy(true);
    setError(undefined);
    const result = await answerInvite({ groupId: invite.groupId, accept });
    setBusy(false);
    if (!result.ok) setError(result.message);
  };
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px]">
      <p>
        <span className="font-medium">{invite.invitedBy}</span> invited you to <span className="font-medium">{invite.groupName}</span>
      </p>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void answer(true)} className="rounded-md bg-ink px-2.5 py-1 font-medium text-on-ink">
          Join
        </button>
        <button type="button" disabled={busy} onClick={() => void answer(false)} className="rounded-md border border-line px-2.5 py-1">
          Decline
        </button>
      </div>
      {error && (
        <p role="alert" className="text-warning">
          {error}
        </p>
      )}
    </li>
  );
}
