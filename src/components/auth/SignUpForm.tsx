"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PASSWORD_MIN } from "@/lib/passwordRules";
import { signUp, type AuthFormState } from "@/server/auth/actions";
import { CheckEmail } from "./CheckEmail";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { primaryButton } from "@/components/ui/buttons";
import { safeNextPath } from "@/lib/safeNextPath";
import { useQuery } from "./useQuery";
import { TermsCheckbox } from "@/components/account/TermsCheckbox";

const initialState: AuthFormState = { status: "idle" };

export function SignUpForm({ terms }: { terms: { terms: string; privacy: string } }) {
  const [state, formAction, pending] = useActionState(signUp, initialState);
  // Where to go once the account is ready (for example a study group invite link).
  const next = safeNextPath(useQuery().get("next"));

  if (state.status === "sent" && state.email) {
    return (
      <CheckEmail email={state.email} resend>
        Open the link in it to finish creating your account. It can take a minute to arrive; check your spam folder too.
      </CheckEmail>
    );
  }

  return (
    <form action={formAction} noValidate className="flex w-full flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <FormAlert message={state.message} />
      <TextField
        label="Your name"
        name="name"
        autoComplete="name"
        required
        maxLength={80}
        hint="Lawdeck greets you by your first name."
        defaultValue={state.name}
        error={state.fieldErrors?.name}
      />
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
      <TermsCheckbox terms={terms.terms} privacy={terms.privacy} error={state.fieldErrors?.agree} />
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Creating your account…" : "Create account"}
      </button>
      <p className="text-sm text-muted">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </form>
  );
}
