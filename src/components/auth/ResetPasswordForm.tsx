"use client";

import { useActionState } from "react";
import { PASSWORD_MIN } from "@/lib/passwordRules";
import { updatePassword, type AuthFormState } from "@/server/auth/actions";
import { FormAlert } from "./FormAlert";
import { TextField } from "./TextField";
import { primaryButton } from "./buttons";

const initialState: AuthFormState = { status: "idle" };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction} noValidate className="flex w-full flex-col gap-4">
      <FormAlert message={state.message} />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        revealable
        required
        hint={`At least ${PASSWORD_MIN} characters.`}
        error={state.fieldErrors?.password}
      />
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
