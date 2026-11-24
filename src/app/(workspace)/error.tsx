"use client";

import { useEffect } from "react";
import { StateMessage } from "@/components/ui/StateMessage";

// Standard error screen (rule I-01): a plain message and a next step, never a blank page.
export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  // The server's reference for this error (no details), so a log line can be found (founder, 2026-11-24).
  const digest = (error as { digest?: string } | null)?.digest;
  useEffect(() => {
    const err = error as { name?: string; message?: string; digest?: string } | null;
    console.error("Workspace error", { name: err?.name });
    // Errors from the server (with a digest) are already reported there; report browser ones (step 7e).
    if (err?.digest) return;
    const report = JSON.stringify({ type: err?.name ?? "Error", message: String(err?.message ?? "").slice(0, 1000), path: window.location.pathname });
    try {
      navigator.sendBeacon("/api/error-report", new Blob([report], { type: "application/json" }));
    } catch {
      // Reporting must never get in the student's way.
    }
  }, [error]);

  return (
    <StateMessage
      title="Something went wrong"
      tone="warning"
      action={
        <button
          type="button"
          onClick={() => retry()}
          className="mt-2 h-11 rounded-xl bg-ink px-5 text-[15px] font-medium text-on-ink"
        >
          Try again
        </button>
      }
    >
      This page could not load. Your work is safe. Try again, or go back to the home page.
      {digest && <span className="mt-2 block text-xs text-muted">Reference: {digest}</span>}
    </StateMessage>
  );
}
