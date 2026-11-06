"use client";

import { useState } from "react";

// The small menu on a message (shown on hover or focus): Delete for your own messages, Report for
// other people's, and Hide for admins.
export function MessageActions({
  mine,
  isAdmin,
  onDelete,
  onReport,
  onHide,
}: {
  mine: boolean;
  isAdmin: boolean;
  onDelete: () => void;
  onReport: () => void;
  onHide: () => void;
}) {
  const [confirm, setConfirm] = useState<"delete" | "hide" | null>(null);
  const link = "text-muted underline underline-offset-2 hover:text-ink";
  return (
    <div className="absolute right-3 top-1 hidden items-center gap-3 rounded-lg border border-line bg-paper px-2 py-1 text-[12px] shadow-sm group-hover:flex group-focus-within:flex">
      {confirm ? (
        <>
          <button type="button" onClick={() => (setConfirm(null), confirm === "delete" ? onDelete() : onHide())} className="text-warning underline underline-offset-2">
            {confirm === "delete" ? "Delete for everyone" : "Hide for everyone"}
          </button>
          <button type="button" onClick={() => setConfirm(null)} className={link}>
            Cancel
          </button>
        </>
      ) : (
        <>
          {!mine && (
            <button type="button" onClick={onReport} className={link} aria-label="Report this message">
              Report
            </button>
          )}
          {isAdmin && !mine && (
            <button type="button" onClick={() => setConfirm("hide")} className={link} aria-label="Hide this message">
              Hide
            </button>
          )}
          {mine && (
            <button type="button" onClick={() => setConfirm("delete")} className={link} aria-label="Delete this message">
              Delete
            </button>
          )}
        </>
      )}
    </div>
  );
}
