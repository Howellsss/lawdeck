"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type AuthFormState } from "@/server/auth/actions";
import { CheckEmail } from "./CheckEmail";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { primaryButton } from "@/components/ui/buttons";

const initialState: AuthFormState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  if (state.status === "sent" && state.email) {
    return (
      <CheckEmail email={state.email}>
        If an account uses this address, the link lets you choose a new password. It works once and expires
        after a short time.
      </CheckEmail>
    );
  }

  return (
    <form action={formAction} noValidate className="flex w-full flex-col gap-4">
      <FormAlert message={state.message} />
      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.email}
        error={state.fieldErrors?.email}
      />
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <Link href="/sign-in" className="text-sm">
        Back to sign in
      </Link>
    </form>
  );
}
