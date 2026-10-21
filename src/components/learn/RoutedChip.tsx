"use client";

import { useState } from "react";
import { DRAFT_LATER } from "@/schemas/learn";

// "Treated as: Learn" on chats that Auto mode routed (PRD WS-03), with a way to say it was
// a drafting request. Drafting arrives in Phase 5, so for now that explains what will happen.
export function RoutedChip() {
  const [draftNote, setDraftNote] = useState(false);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-line px-3 py-1 text-muted">Treated as: Learn</span>
        {!draftNote && (
          <button type="button" onClick={() => setDraftNote(true)} className="underline underline-offset-2">
            Switch to Draft
          </button>
        )}
      </div>
      {draftNote && (
        <p role="status" className="text-muted">
          {DRAFT_LATER} Until then, Lawdeck can explain what the document needs: ask below.
        </p>
      )}
    </div>
  );
}
