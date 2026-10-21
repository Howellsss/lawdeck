"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { PROJECT_NAME_MAX } from "@/schemas/projects";
import { createProject, type ProjectFormState } from "@/server/projects/actions";

const initialState: ProjectFormState = { status: "idle" };

// Name a new project. On success the server opens the new project's page.
export function NewProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <FormAlert message={state.message} />
        <TextField
          label="New project"
          name="name"
          placeholder="e.g. Civil Litigation revision"
          maxLength={PROJECT_NAME_MAX}
          autoComplete="off"
          required
          defaultValue={state.name}
          error={state.fieldErrors?.name}
        />
      </div>
      <button type="submit" disabled={pending} className={`${compactPrimaryButton} sm:mb-[7px]`}>
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
