"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { primaryButton } from "@/components/ui/buttons";
import { safeNextPath } from "@/lib/safeNextPath";
import { signInWithGoogle, type AuthFormState } from "@/server/auth/actions";
import { useQuery } from "./useQuery";

const initialState: AuthFormState = { status: "idle" };

// "Continue with Google" (design board M1). Shown only when Google sign-in is switched on.
export function GoogleButton() {
  const [state, formAction, pending] = useActionState(signInWithGoogle, initialState);
  const next = safeNextPath(useQuery().get("next"));

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <FormAlert message={state.message} />
      <button type="submit" disabled={pending} className={`${primaryButton} gap-2.5`}>
        <GoogleMark />
        {pending ? "Opening Google…" : "Continue with Google"}
      </button>
    </form>
  );
}

// A simple monochrome "G", matching the design board (no brand colours).
function GoogleMark() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M17 10.2c0-.6-.1-1.1-.2-1.6H10v3h4a3.5 3.5 0 01-1.5 2.3M16.2 13.8A7 7 0 1114.8 5" />
    </svg>
  );
}

// "or" between Google and email.
export function OrDivider() {
  return (
    <p className="flex w-full items-center gap-3 text-sm text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </p>
  );
}
