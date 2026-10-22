"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton, compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { RUBRIC_STATUS_LABELS } from "@/schemas/rubrics";
import type { RubricStatus } from "@/server/db/rubrics";
import { deleteRubric, setRubricStatus } from "@/server/rubrics/actions";

// A guide's status and the actions on it: approve, withdraw, back to draft, and (admins) delete.
// Only approved guides are used to mark students.
export function RubricStatusBar({ id, status, isAdmin }: { id: string; status: RubricStatus; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function change(next: "approved" | "pending" | "withdrawn") {
    setBusy(true);
    setMessage(undefined);
    const result = await setRubricStatus(id, next);
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const result = await deleteRubric(id);
    if (result.ok) return router.push("/admin/rubrics");
    setBusy(false);
    setMessage(result.message);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <p>
        Status: <strong className={status === "approved" ? "text-success" : ""}>{RUBRIC_STATUS_LABELS[status]}</strong>
        {status === "approved" ? " · used to mark students" : " · not used to mark students"}
      </p>
      <div className="flex flex-wrap gap-3">
        {status !== "approved" && (
          <button type="button" disabled={busy} onClick={() => void change("approved")} className={compactPrimaryButton}>
            Approve
          </button>
        )}
        {status === "approved" && (
          <button type="button" disabled={busy} onClick={() => void change("pending")} className={compactSecondaryButton}>
            Back to draft
          </button>
        )}
        {status !== "withdrawn" && (
          <button type="button" disabled={busy} onClick={() => void change("withdrawn")} className={compactSecondaryButton}>
            Withdraw
          </button>
        )}
        {isAdmin &&
          (confirmDelete ? (
            <button type="button" disabled={busy} onClick={() => void remove()} className={compactWarningButton}>
              Yes, delete this guide
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={compactWarningButton}>
              Delete
            </button>
          ))}
      </div>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
    </div>
  );
}
