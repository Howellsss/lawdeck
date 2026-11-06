"use client";

import { useState } from "react";
import { compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { closeReports, hideFromQueue } from "@/server/chat/moderation";

export type Reported = {
  id: string;
  body: string;
  files: string[];
  group: string;
  author: string;
  email: string;
  posted: string;
  hidden: boolean;
  reports: number;
  open: number;
  reasons: string[];
  notes: string[];
};

const REASON: Record<string, string> = { abuse: "Rude or vulgar", contact: "Contact details", cheating: "Cheating", spam: "Spam", other: "Other" };

// One reported message for an admin: what it says, who wrote it and why it was reported; hide it
// for everyone (which closes the reports), show it again, or close the reports and keep it.
export function ReportedRow({ r }: { r: Reported }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const run = async (act: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    setBusy(true);
    setError(undefined);
    const result = await act();
    setBusy(false);
    if (!result.ok) setError(result.message);
  };
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <p className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
        <span className="font-medium">{r.author}</span>
        <span className="text-muted">{r.email}</span>
        <span className="text-muted">· {r.group} · {r.posted}</span>
        {r.hidden && <span className="rounded border border-line px-1.5 text-[12px] text-muted">Hidden</span>}
      </p>
      <blockquote className="whitespace-pre-wrap break-words border-l-2 border-line pl-3 text-[15px]">{r.body.trim() || <span className="text-muted">(files only)</span>}</blockquote>
      {r.files.length > 0 && <p className="text-[13px] text-muted">Files: {r.files.join(", ")}</p>}
      <p className="text-[13px]">
        <strong className="font-medium">
          {r.reports} report{r.reports === 1 ? "" : "s"}
          {r.open > 0 && r.open < r.reports ? ` (${r.open} open)` : ""}:
        </strong>{" "}
        {r.reasons.map((x) => REASON[x] ?? x).join(", ")}
      </p>
      {r.notes.length > 0 && (
        <ul className="list-disc pl-5 text-[13px] text-muted">
          {r.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-warning">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {r.hidden ? (
          <button type="button" disabled={busy} onClick={() => void run(() => hideFromQueue({ id: r.id, hide: false }))} className={compactSecondaryButton}>
            Show again
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void run(() => hideFromQueue({ id: r.id, hide: true }))} className={compactWarningButton}>
            Hide for everyone
          </button>
        )}
        {r.open > 0 && !r.hidden && (
          <button type="button" disabled={busy} onClick={() => void run(() => closeReports({ id: r.id }))} className={compactSecondaryButton}>
            Keep it, close reports
          </button>
        )}
      </div>
    </li>
  );
}
