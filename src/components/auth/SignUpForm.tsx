"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PASSWORD_MIN } from "@/lib/passwordRules";
import { signUp, type AuthFormState } from "@/server/auth/actions";
import { CheckEmail } from "./CheckEmail";
import { FormAlert } from "./FormAlert";
import { TextField } from "./TextField";
import { primaryButton } from "./buttons";

const initialState: AuthFormState = { status: "idle" };

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  if (state.status === "sent" && state.email) {
    return (
      <CheckEmail email={state.email} resend>
        Open the link in it to finish creating your account. It can take a minute to arrive; check your spam folder too.
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
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        revealable
        required
        hint={`At least ${PASSWORD_MIN} characters. A short sentence is easy to remember.`}
        error={state.fieldErrors?.password}
      />
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Creating your account…" : "Create account"}
      </button>
      <p className="text-sm text-muted">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </form>
  );
}
