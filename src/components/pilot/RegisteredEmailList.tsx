"use client";

import { useState, useTransition } from "react";
import { compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { formatWat } from "@/lib/dates";
import type { PilotEmailRow } from "@/server/db/pilot";
import { removePilotEmail } from "@/server/pilot/actions";

// Admin: the registered emails, whether each person has joined, and Remove (after a second tap).
export function RegisteredEmailList({ emails }: { emails: PilotEmailRow[] }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  if (emails.length === 0) return <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-muted">No emails registered yet.</p>;

  function remove(id: string) {
    startTransition(async () => {
      const result = await removePilotEmail(id);
      setConfirming(null);
      setMessage(result.ok ? undefined : result.message);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        {emails.length} registered · {emails.filter((e) => e.joined).length} joined
      </p>
      <ul aria-label="Registered emails" className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
        {emails.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="break-all">{entry.email}</span>
              <span className="text-sm text-muted">
                {entry.joined ? <span className="text-success">Joined</span> : "Not joined yet"} · added {formatWat(entry.createdAt)}
              </span>
            </div>
            {confirming === entry.id ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={() => remove(entry.id)} className={compactWarningButton}>
                  {pending ? "Removing…" : "Yes, remove"}
                </button>
                <button type="button" disabled={pending} onClick={() => setConfirming(null)} className={compactSecondaryButton}>
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(entry.id)} className={compactSecondaryButton}>
                Remove<span className="sr-only"> {entry.email}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
