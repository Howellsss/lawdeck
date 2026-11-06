"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import type { ChatGroup, GroupPerson } from "@/server/chat/data";
import { deleteGroup, leaveGroup, removeMember, renameGroup } from "@/server/chat/groups";
import { InvitePeople } from "./InvitePeople";

// A study group's Members tab: who is in it and who is invited; invite more people; the creator
// renames the group, removes people or deletes it; others can leave.
export function MembersPanel({ group, people, me }: { group: ChatGroup; people: GroupPerson[]; me: string }) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const run = async (act: () => Promise<{ ok: true } | { ok: false; message: string }>, after?: () => void) => {
    setBusy(true);
    setError(undefined);
    const result = await act();
    setBusy(false);
    if (!result.ok) return setError(result.message);
    after?.();
  };
  const members = people.filter((p) => p.status === "member");
  const invited = people.filter((p) => p.status === "invited");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 lg:px-6">
      {error && (
        <p role="alert" className="text-[14px] text-warning">
          {error}
        </p>
      )}
      <InvitePeople groupId={group.id} />
      <section aria-labelledby="members-h" className="flex flex-col gap-2">
        <h2 id="members-h" className="text-[16px] font-medium">
          Members ({members.length}){invited.length > 0 && <span className="font-normal text-muted"> · {invited.length} invited</span>}
        </h2>
        <ul className="flex max-w-xl flex-col divide-y divide-line rounded-xl border border-line">
          {[...members, ...invited].map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[15px]">
                <span className="font-medium">{p.name}</span>
                {p.id === me && <span className="text-muted"> (you)</span>}
                {p.campus && <span className="ml-2 text-[13px] text-muted">{p.campus}</span>}
              </span>
              {p.isOwner && <span className="rounded border border-line px-1.5 text-[12px] text-muted">Created the group</span>}
              {p.status === "invited" && <span className="rounded border border-line px-1.5 text-[12px] text-muted">Invited</span>}
              {group.mine && p.id !== me && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => window.confirm(`Remove ${p.name} from ${group.name}?`) && void run(() => removeMember({ groupId: group.id, personId: p.id }))}
                  className="text-[13px] text-muted underline underline-offset-2 hover:text-ink"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      {group.mine ? (
        <section aria-labelledby="settings-h" className="flex max-w-xl flex-col gap-3 border-t border-line pt-5">
          <h2 id="settings-h" className="text-[16px] font-medium">
            Group settings
          </h2>
          <form onSubmit={(e) => (e.preventDefault(), void run(() => renameGroup({ groupId: group.id, name })))} className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[14px]">
              Group name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-10 rounded-lg border border-line bg-surface px-3 text-[16px]" />
            </label>
            <button type="submit" disabled={busy || name.trim() === group.name} className={compactPrimaryButton}>
              Rename
            </button>
          </form>
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                window.confirm(`Delete ${group.name} for everyone? Its messages and files go with it.`) &&
                void run(() => deleteGroup({ groupId: group.id }), () => router.push("/chat"))
              }
              className={compactWarningButton}
            >
              Delete group
            </button>
          </div>
        </section>
      ) : (
        <div className="border-t border-line pt-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => window.confirm(`Leave ${group.name}?`) && void run(() => leaveGroup({ groupId: group.id }), () => router.push("/chat"))}
            className={compactSecondaryButton}
          >
            Leave group
          </button>
        </div>
      )}
    </div>
  );
}
