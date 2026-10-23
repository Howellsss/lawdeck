"use client";

import { useActionState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { saveOwnName, type NameState } from "@/server/account/nameActions";

// "Your name": used only to greet you ("Good morning, Ada").
export function NameForm({ name }: { name: string | null }) {
  const [state, action, pending] = useActionState(saveOwnName, { status: "idle", name: name ?? "" } as NameState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Your name
        <input
          name="name"
          defaultValue={state.name}
          autoComplete="name"
          maxLength={80}
          aria-invalid={state.status === "error"}
          aria-describedby="name-note"
          className="h-11 rounded-lg border border-line bg-surface px-3 text-[15px] font-normal"
        />
      </label>
      <p id="name-note" className="text-sm text-muted">
        Only used to greet you on the home page. Leave it empty for no name.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={compactPrimaryButton}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state.status === "saved" && (
          <p role="status" className="text-sm text-success">
            Saved.
          </p>
        )}
        {state.status === "error" && state.message && (
          <p role="alert" className="text-sm text-warning">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
