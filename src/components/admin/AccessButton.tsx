"use client";

import { useState, useTransition } from "react";
import { setPilotAccess } from "@/server/pilot/actions";

// Admin, Users page: give or remove one person's access while Lawdeck is invite-only
// (migration 35). The same access an invite code gives; the database records who did it.
export function AccessButton({ person, name, hasAccess }: { person: string; name: string; hasAccess: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <span className={hasAccess ? "text-success" : "text-muted"}>{hasAccess ? "Has access" : "Waiting"}</span>
      <button
        type="button"
        disabled={pending}
        aria-label={`${hasAccess ? "Remove access for" : "Give access to"} ${name}`}
        onClick={() =>
          startTransition(async () => {
            const result = await setPilotAccess({ person, allow: !hasAccess });
            setError(result.ok ? null : result.message);
          })
        }
        className={`inline-flex h-9 items-center rounded-full px-3 text-[13px] font-medium disabled:opacity-60 ${
          hasAccess ? "border border-line text-ink hover:bg-pill" : "bg-ink text-on-ink"
        }`}
      >
        {pending ? "Saving…" : hasAccess ? "Remove access" : "Give access"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-warning">
          {error}
        </span>
      )}
    </div>
  );
}
