"use client";

import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton } from "@/components/ui/buttons";
import { setChatOpen } from "@/server/chat/moderation";

// Admins: open campus chat to verified students, or close it again (staff can always use it).
export function ChatOpenSwitch({ open }: { open: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const change = async () => {
    if (!window.confirm(open ? "Close campus chat to students? Staff can still use it." : "Open campus chat to verified students now?")) return;
    setBusy(true);
    setError(undefined);
    const result = await setChatOpen({ open: !open });
    setBusy(false);
    if (!result.ok) setError(result.message);
  };
  return (
    <section aria-labelledby="chat-open" className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <h2 id="chat-open" className="text-lg font-medium">
          Campus chat is {open ? "open to verified students" : "closed to students"}
        </h2>
        <p className="text-[14px] text-muted">
          {open ? "Verified students see their own campus group and All campuses; aspirants see Aspirants." : "Only staff can use chat. Students can still ask to be verified."}
        </p>
        {error && (
          <p role="alert" className="text-[14px] text-warning">
            {error}
          </p>
        )}
      </div>
      <button type="button" onClick={() => void change()} disabled={busy} className={open ? compactSecondaryButton : compactPrimaryButton}>
        {busy ? "Saving…" : open ? "Close chat to students" : "Open chat to students"}
      </button>
    </section>
  );
}
