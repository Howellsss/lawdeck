"use client";

import { useState } from "react";
import { compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { formatWat } from "@/lib/dates";
import type { OwnShare } from "@/server/db/sharing";
import { revokeShare } from "@/server/sharing/actions";

// One live view-only link: copy it, see who opened it, or turn it off (after a second tap).
export function ShareLink({ share }: { share: OwnShare }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const path = `/shared/${share.token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setMessage(undefined);
    } catch {
      setMessage("The link couldn’t be copied. Open it and copy it from the address bar.");
    }
  }

  async function turnOff() {
    setBusy(true);
    const result = await revokeShare(share.id);
    setBusy(false);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-col gap-1">
        <a href={path} className="break-all text-sm">
          View-only link made {formatWat(share.createdAt)}
        </a>
        {share.viewers.length === 0 ? (
          <p className="text-sm text-muted">Nobody has opened it yet.</p>
        ) : (
          <ul aria-label="Who opened this link" className="text-sm text-muted">
            {share.viewers.map((viewer, index) => (
              <li key={index}>
                {viewer.name} · last opened {formatWat(viewer.lastSeenAt)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {confirming ? (
          <>
            <button type="button" disabled={busy} onClick={() => void turnOff()} className={compactWarningButton}>
              {busy ? "Turning off…" : "Yes, turn it off"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={compactSecondaryButton}>
              Keep it
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => void copy()} className={compactSecondaryButton}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" onClick={() => setConfirming(true)} className={compactSecondaryButton}>
              Turn off link
            </button>
          </>
        )}
      </div>
      {copied && !message && (
        <p className="sr-only" role="status">
          Link copied.
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </li>
  );
}
