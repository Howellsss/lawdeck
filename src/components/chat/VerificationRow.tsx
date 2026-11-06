"use client";

import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { decideVerification, viewVerificationDocument } from "@/server/chat/verification";

export type Request = {
  id: string;
  name: string | null;
  email: string;
  kind: "student" | "aspirant";
  campus: string | null;
  idNumber: string;
  hasDocument: boolean;
  status: "pending" | "approved" | "rejected" | "revoked";
  note: string | null;
  when: string;
};

// One verification request for an admin: open the ID, then approve, reject with a reason, or (once
// approved) remove the person from chat. The ID is deleted as soon as a decision is made.
export function VerificationRow({ r }: { r: Request }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const decide = async (decision: "approved" | "rejected" | "revoked") => {
    if (decision === "revoked" && !window.confirm(`Remove ${r.name ?? r.email} from campus chat for good?`)) return;
    setBusy(true);
    setMessage(undefined);
    const result = await decideVerification({ id: r.id, decision, note: reason });
    setBusy(false);
    if (!result.ok) setMessage(result.message);
  };
  const open = async () => {
    const result = await viewVerificationDocument({ id: r.id });
    if (!result.ok) return setMessage(result.message);
    window.open(result.url, "_blank", "noopener,noreferrer");
  };
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="min-w-0 break-words">
          <span className="font-medium">{r.name ?? "No name"}</span> <span className="text-sm text-muted">{r.email}</span>
        </p>
        <p className="text-sm text-muted">{r.when}</p>
      </div>
      <p className="text-sm">
        {r.kind === "student" ? `Law School student · ${r.campus ?? ""} campus` : "Aspirant"} · number <span className="font-mono">{r.idNumber}</span>
        {r.status !== "pending" && (
          <span className={r.status === "approved" ? "text-success" : "text-warning"}>
            {" "}
            · {r.status === "approved" ? "Approved" : r.status === "rejected" ? "Rejected" : "Removed from chat"}
            {r.note ? `: ${r.note}` : ""}
          </span>
        )}
      </p>
      {r.status === "pending" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {r.hasDocument && (
              <button type="button" onClick={() => void open()} className={compactSecondaryButton}>
                View ID
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => void decide("approved")} className={compactPrimaryButton}>
              Approve
            </button>
            <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void decide("rejected")} className={compactSecondaryButton}>
              Reject
            </button>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Reason if rejecting (the student sees it)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="h-9 rounded-lg border border-line bg-surface px-3 text-[15px] sm:max-w-md" />
          </label>
        </div>
      )}
      {r.status === "approved" && (
        <button type="button" disabled={busy} onClick={() => void decide("revoked")} className={`${compactWarningButton} self-start`}>
          Remove from chat
        </button>
      )}
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </li>
  );
}
