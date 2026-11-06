"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { callStatus, joinCall, type CallPass, type CallStatus } from "@/server/chat/calls";
import { ActiveCall } from "./ActiveCall";

const CHECK_EVERY = 10_000;

// The call line at the top of a study group: "Start a call", or "Call in progress" with who is in
// it and Join. Checked every 10 seconds while the page is in view.
export function CallBar({ groupId, initialStatus = null }: { groupId: string; initialStatus?: CallStatus }) {
  const [status, setStatus] = useState<CallStatus>(initialStatus);
  const [pass, setPass] = useState<Omit<CallPass, "ok"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    if (pass) return;
    const check = () => document.visibilityState === "visible" && void callStatus({ groupId }).then(setStatus);
    const timer = window.setInterval(check, CHECK_EVERY);
    return () => window.clearInterval(timer);
  }, [groupId, pass]);

  const join = async () => {
    setBusy(true);
    setNotice(undefined);
    const result = await joinCall({ groupId });
    setBusy(false);
    if (!result.ok) return setNotice(result.message);
    setPass({ callId: result.callId, url: result.url, token: result.token });
  };
  const ended = useCallback(
    (why?: string) => {
      setPass(null);
      setNotice(why);
      void callStatus({ groupId }).then(setStatus);
    },
    [groupId],
  );

  if (pass) return <ActiveCall pass={pass} onEnded={ended} />;
  const people = status?.people ?? [];
  return (
    <section aria-label="Group call" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5 lg:px-6">
      <p className="w-full min-w-0 text-[14px] sm:w-auto sm:flex-1">
        {status ? (
          <>
            <span className="font-medium">📞 Call in progress</span>
            <span className="text-muted"> · {people.length ? people.slice(0, 4).join(", ") + (people.length > 4 ? ` and ${people.length - 4} more` : "") : "starting"}</span>
          </>
        ) : (
          <span className="text-muted">Talk with your group here. Audio first, never recorded.</span>
        )}
      </p>
      <button
        type="button"
        onClick={() => void join()}
        disabled={busy}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-medium text-on-ink disabled:opacity-60"
      >
        <Icon name="phone" size={16} /> {busy ? "Connecting…" : status ? "Join call" : "Start a call"}
      </button>
      {notice && (
        <p role="alert" className="w-full text-[13px] text-warning">
          {notice}
        </p>
      )}
    </section>
  );
}
