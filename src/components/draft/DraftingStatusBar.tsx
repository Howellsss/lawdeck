"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  compactPrimaryButton,
  compactSecondaryButton,
  compactWarningButton,
} from "@/components/ui/buttons";
import { DRAFTING_STATUS_LABELS } from "@/schemas/drafting";
import type { DraftingStatus } from "@/server/db/drafting";
import {
  deleteDraftingItem,
  setForumStatus,
  setTemplateStatus,
  type DraftingActionResult,
} from "@/server/documents/actions";

type Props = {
  kind: "forum" | "template";
  id: string;
  name: string;
  status: DraftingStatus;
  isAdmin: boolean;
  afterDelete?: string;
};

// A court's, registry's or template's status and the actions on it: approve (only once it passes
// the checks), back to draft, withdraw, and (admins) delete. Students see approved ones only.
export function DraftingStatusBar({
  kind,
  id,
  name,
  status,
  isAdmin,
  afterDelete,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{
    message: string;
    issues?: string[];
  }>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function settle(result: DraftingActionResult) {
    setBusy(false);
    if (!result.ok)
      return setProblem({ message: result.message, issues: result.issues });
    router.refresh();
  }

  async function change(next: "approved" | "pending" | "withdrawn") {
    setBusy(true);
    setProblem(undefined);
    settle(
      await (kind === "forum"
        ? setForumStatus(id, next)
        : setTemplateStatus(id, next)),
    );
  }

  async function remove() {
    setBusy(true);
    const result = await deleteDraftingItem(kind, id);
    if (result.ok && afterDelete) return router.push(afterDelete);
    settle(result);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Status:{" "}
        <strong className={status === "approved" ? "text-success" : ""}>
          {DRAFTING_STATUS_LABELS[status]}
        </strong>
        {status === "approved"
          ? " · students can use it"
          : " · hidden from students"}
      </p>
      <div className="flex flex-wrap gap-3">
        {status !== "approved" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void change("approved")}
            className={compactPrimaryButton}
            aria-label={`Approve ${name}`}
          >
            Approve
          </button>
        )}
        {status === "approved" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void change("pending")}
            className={compactSecondaryButton}
            aria-label={`Back to draft: ${name}`}
          >
            Back to draft
          </button>
        )}
        {status !== "withdrawn" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void change("withdrawn")}
            className={compactSecondaryButton}
            aria-label={`Withdraw ${name}`}
          >
            Withdraw
          </button>
        )}
        {isAdmin &&
          (confirmDelete ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className={compactWarningButton}
            >
              Yes, delete it
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={compactWarningButton}
              aria-label={`Delete ${name}`}
            >
              Delete
            </button>
          ))}
      </div>
      {problem && (
        <div role="alert" className="text-sm text-warning">
          <p>{problem.message}</p>
          {problem.issues && (
            <ul className="mt-1 list-disc pl-5">
              {problem.issues.map((issue) => (
                <li key={issue} className="break-words">
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
