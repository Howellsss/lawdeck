"use client";

import { useState } from "react";
import { compactPrimaryButton, compactWarningButton } from "@/components/ui/buttons";
import { setAutoApproveIds } from "@/server/chat/moderation";

// Admins: "Approve IDs automatically (testing)". While on, anyone who types a number is let into
// chat at once, with no document and no admin check. For testing only.
export function IdTestSwitch({ on }: { on: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const change = async () => {
    if (!on && !window.confirm("Approve every chat ID request automatically? Anyone who types a number gets into chat. Use this for testing only.")) return;
    setBusy(true);
    setError(undefined);
    const result = await setAutoApproveIds({ on: !on });
    setBusy(false);
    if (!result.ok) setError(result.message);
  };
  return (
    <section aria-labelledby="id-test" className={`flex flex-col gap-2 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${on ? "border-warning" : "border-line bg-surface"}`}>
      <div className="flex flex-col gap-0.5">
        <h2 id="id-test" className="text-lg font-medium">
          Approve IDs automatically (testing): {on ? <span className="text-warning">on</span> : "off"}
        </h2>
        <p className="text-[14px] text-muted">
          {on
            ? "Anyone who types any number (for example 123) gets into chat straight away, with no document and no check. Turn this off before real students join."
            : "Every chat ID request waits for an admin to check it. Turn this on to let testers in with any number."}
        </p>
        {error && (
          <p role="alert" className="text-[14px] text-warning">
            {error}
          </p>
        )}
      </div>
      <button type="button" onClick={() => void change()} disabled={busy} className={on ? compactPrimaryButton : compactWarningButton}>
        {busy ? "Saving…" : on ? "Turn off" : "Turn on for testing"}
      </button>
    </section>
  );
}
