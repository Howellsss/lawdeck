"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { compactSecondaryButton, compactWarningButton } from "@/components/ui/buttons";
import { deleteProject, type ProjectFormState } from "@/server/projects/actions";

const initialState: ProjectFormState = { status: "idle" };

// Deleting is permanent, so it takes two steps: "Delete project", then a clear confirmation.
export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState(deleteProject, initialState);
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={compactWarningButton}>
        Delete project
      </button>
    );
  }

  return (
    <form
      action={formAction}
      role="group"
      aria-labelledby={`delete-${id}`}
      className="flex flex-col gap-3 rounded-2xl border border-warning p-4"
    >
      <input type="hidden" name="id" value={id} />
      <p id={`delete-${id}`} className="text-[15px] leading-relaxed">
        Delete <strong className="break-words">{name}</strong>? This can’t be undone. Its chats are kept and move to
        Recents.
      </p>
      <FormAlert message={state.message} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={compactWarningButton}>
          {pending ? "Deleting…" : "Yes, delete it"}
        </button>
        <button ref={cancelRef} type="button" onClick={() => setConfirming(false)} className={compactSecondaryButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
