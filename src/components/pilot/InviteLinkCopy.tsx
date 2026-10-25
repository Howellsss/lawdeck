"use client";

import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";

// Admin: the invite link to send to registered testers (migration 36). Only registered emails
// get in through it, so passing it on lets nobody else in.
export function InviteLinkCopy() {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string>();

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite`);
      setCopied(true);
      setMessage(undefined);
    } catch {
      setMessage("The link couldn’t be copied. Open it and copy it from the address bar.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void copy()} className={compactPrimaryButton}>
          {copied ? "Copied" : "Copy invite link"}
        </button>
        <a href="/invite" className="break-all text-sm">
          Open the invite page
        </a>
      </div>
      {copied && !message && (
        <p role="status" className="text-sm text-muted">
          Invite link copied. Paste it in your message to the tester.
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
