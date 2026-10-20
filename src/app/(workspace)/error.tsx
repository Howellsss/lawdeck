"use client";

import { useEffect } from "react";
import { StateMessage } from "@/components/ui/StateMessage";

// Standard error screen (rule I-01): a plain message and a next step, never a blank page.
export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("Workspace error", { name: (error as Error)?.name });
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
    </StateMessage>
  );
}
