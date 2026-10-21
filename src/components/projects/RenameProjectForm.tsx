"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { PROJECT_NAME_MAX } from "@/schemas/projects";
import { renameProject, type ProjectFormState } from "@/server/projects/actions";

const initialState: ProjectFormState = { status: "idle" };

export function RenameProjectForm({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState(renameProject, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <FormAlert
        message={state.status === "saved" ? "Name saved." : state.message}
        tone={state.status === "saved" ? "success" : "warning"}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="Project name"
            name="name"
            maxLength={PROJECT_NAME_MAX}
            autoComplete="off"
            required
            defaultValue={state.name ?? name}
            error={state.fieldErrors?.name}
          />
        </div>
        <button type="submit" disabled={pending} className={`${compactSecondaryButton} sm:mb-[7px]`}>
          {pending ? "Saving…" : "Rename"}
        </button>
      </div>
    </form>
  );
}
