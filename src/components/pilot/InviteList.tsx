"use client";

import { useTransition } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { formatWat } from "@/lib/dates";
import type { InviteCodeRow } from "@/server/db/pilot";
import { disableInvite } from "@/server/pilot/actions";

function state(code: InviteCodeRow): string {
  if (code.disabled) return "Switched off";
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return "Expired";
  if (code.uses >= code.maxUses) return "Used up";
  return "Working";
}

// Admin: the invite codes, with how many students used each, and a way to switch one off.
export function InviteList({ codes }: { codes: InviteCodeRow[] }) {
  const [pending, startTransition] = useTransition();
  if (codes.length === 0) return <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-muted">No invite codes yet.</p>;
  return (
    <ul aria-label="Invite codes" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
      {codes.map((code) => (
        <li key={code.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-mono text-base tracking-wider">{code.code}</span>
            <span className="text-sm text-muted">
              {code.label} · {code.uses} of {code.maxUses} used · {state(code)}
              {code.expiresAt ? ` · ends ${formatWat(code.expiresAt)}` : ""}
            </span>
          </div>
          {state(code) === "Working" && (
            <button type="button" disabled={pending} className={compactSecondaryButton} onClick={() => startTransition(async () => void (await disableInvite(code.id)))}>
              Switch off<span className="sr-only"> {code.code}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
