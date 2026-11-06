"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButton } from "@/components/ui/buttons";
import { claimLinkAccess, joinByLink, type LinkStep } from "@/server/chat/links";

// The last steps on an invite link: get into Lawdeck (while it is invite-only), then Join.
export function JoinStep({ code, step, groupName }: { code: string; step: LinkStep; groupName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const go = async () => {
    setBusy(true);
    setError(undefined);
    if (step === "access") {
      const result = await claimLinkAccess({ code });
      setBusy(false);
      if (!result.ok) return setError(result.message);
      return router.refresh();
    }
    const result = await joinByLink({ code });
    if (!result.ok) return (setBusy(false), setError(result.message));
    router.push(`/chat/${result.groupKey}`);
  };
  return (
    <section aria-label="Join" className="mx-auto mt-4 flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <p className="text-[15px]">{step === "access" ? "This link gives you access to Lawdeck. Continue to confirm you’re a student." : `You’re all set to join ${groupName}.`}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void go()} disabled={busy} className={primaryButton}>
          {busy ? "One moment…" : step === "access" ? "Continue" : `Join ${groupName}`}
        </button>
        {error && (
          <p role="alert" className="text-sm text-warning">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
