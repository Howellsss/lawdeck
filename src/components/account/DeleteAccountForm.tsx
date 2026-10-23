"use client";

import { useActionState, useState } from "react";
import { compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { deleteAccount, type DeleteAccountState } from "@/server/account/actions";

const INITIAL: DeleteAccountState = { status: "idle" };

// "Delete my account" (PRD AC-05): opens a confirmation where the student types DELETE.
export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, INITIAL);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${compactWarningButton} self-start`}>
        Delete my account
      </button>
    );

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-warning p-4">
      <p className="text-[15px]">
        This deletes your account and everything in it straight away: chats, documents, projects, briefs, practice sets, uploads
        and share links. It can’t be undone. Download anything you want to keep first.
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Type DELETE to confirm
        <input
          name="confirm"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={state.status === "error"}
          aria-describedby={state.message ? "delete-account-error" : undefined}
          className="h-11 rounded-lg border border-line bg-surface px-3 text-[15px] font-normal"
        />
      </label>
      {state.message && (
        <p id="delete-account-error" role="alert" className="text-sm text-warning">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={compactWarningButton}>
          {pending ? "Deleting…" : "Delete my account for good"}
        </button>
        <button type="button" disabled={pending} onClick={() => setOpen(false)} className={compactSecondaryButton}>
          Keep my account
        </button>
      </div>
    </form>
  );
}
