"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { setCallLimit } from "@/server/chat/calls";

// Admins: group call minutes used this month and the monthly limit (kept just under LiveKit's free
// 5,000 minutes, so Lawdeck is never charged unless the founder chooses a paid plan).
export function CallUsage({ used, limit, calls, enabled }: { used: number; limit: number; calls: number; enabled: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(String(limit));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const share = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await setCallLimit({ minutes: Number(value) });
    setBusy(false);
    setMessage(result.ok ? { ok: true, text: "Saved." } : { ok: false, text: result.message });
    if (result.ok) router.refresh();
  };
  return (
    <section aria-labelledby="call-usage" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="call-usage" className="text-lg font-medium">
          Group calls this month
        </h2>
        <p className="text-[14px] text-muted">
          {enabled ? "Study group calls are switched on (LiveKit)." : "Switched off until the LiveKit keys are added in Vercel."} {calls} call{calls === 1 ? "" : "s"} so far.
        </p>
      </div>
      <div>
        <p className="text-[15px]">
          <span className="font-semibold">{used.toLocaleString("en-NG")}</span> of {limit.toLocaleString("en-NG")} minutes used
        </p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-pill" role="presentation">
          <div className={`h-full ${share >= 90 ? "bg-warning" : "bg-ink"}`} style={{ width: `${share}%` }} />
        </div>
        {share >= 90 && <p className="pt-1 text-[13px] text-warning">Nearly at the limit: calls stop when it is reached, until the 1st.</p>}
      </div>
      <form onSubmit={(e) => void save(e)} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[14px] font-medium">
          Monthly limit (minutes)
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" pattern="[0-9]*" className="h-11 w-40 rounded-lg border border-line bg-paper px-3 text-[16px] font-normal" />
        </label>
        <button type="submit" disabled={busy} className={compactSecondaryButton}>
          {busy ? "Saving…" : "Save limit"}
        </button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-[14px] ${message.ok ? "text-muted" : "text-warning"}`}>
            {message.text}
          </p>
        )}
      </form>
      <p className="text-[13px] text-muted">LiveKit’s free plan includes 5,000 minutes a month. One minute is one person in a call for one minute.</p>
    </section>
  );
}
