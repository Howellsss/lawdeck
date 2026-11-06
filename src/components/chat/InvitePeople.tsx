"use client";

import { useEffect, useId, useState } from "react";
import type { ChatPerson } from "@/server/chat/data";
import { findInvitees, inviteToGroup } from "@/server/chat/groups";

// Invite classmates by name: chat members on the same side only (students or aspirants), never by
// email or phone number.
export function InvitePeople({ groupId }: { groupId: string }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    if (!q.trim()) return;
    const timer = window.setTimeout(() => void findInvitees({ groupId, q }).then(setPeople), 250);
    return () => window.clearTimeout(timer);
  }, [q, groupId]);

  const invite = async (p: ChatPerson) => {
    const result = await inviteToGroup({ groupId, personId: p.id });
    setMessage(result.ok ? { ok: true, text: `${p.name} is invited. They’ll see it in their group list.` } : { ok: false, text: result.message });
    if (result.ok) {
      setQ("");
      setPeople([]);
    }
  };

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-2">
      <h2 id={`${id}-h`} className="text-[16px] font-medium">
        Invite classmates
      </h2>
      <label htmlFor={`${id}-q`} className="text-[14px] text-muted">
        Type a name. Only verified chat members can be invited.
      </label>
      <input
        id={`${id}-q`}
        type="search"
        value={q}
        onChange={(e) => (setQ(e.target.value), !e.target.value.trim() && setPeople([]))}
        placeholder="Search by name"
        maxLength={40}
        className="h-11 w-full max-w-md rounded-lg border border-line bg-surface px-3 text-[16px] placeholder:text-muted"
      />
      {q.trim() && (
        <ul aria-label="People to invite" className="flex max-w-md flex-col divide-y divide-line rounded-xl border border-line">
          {people.length === 0 ? (
            <li className="px-3 py-2 text-[14px] text-muted">No one found. They need to be verified and in chat first.</li>
          ) : (
            people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  <span className="font-medium">{p.name}</span>
                  {p.campus && <span className="ml-2 text-[13px] text-muted">{p.campus}</span>}
                </span>
                <button type="button" onClick={() => void invite(p)} className="rounded-md bg-ink px-3 py-1 text-[13px] font-medium text-on-ink">
                  Invite
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-[14px] ${message.ok ? "text-success" : "text-warning"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
