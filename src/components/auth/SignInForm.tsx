"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { safeNextPath } from "@/lib/safeNextPath";
import { signIn, type AuthFormState } from "@/server/auth/actions";
import { FormAlert } from "./FormAlert";
import { TextField } from "./TextField";
import { primaryButton } from "./buttons";

// A quick shape check so step one can move on without a server trip. The server checks properly.
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const initialState: AuthFormState = { status: "idle" };
const LINK_FAILED = "That link has expired or was already used. Sign in below, or ask for a new link.";

// The page address (?next=… and ?error=…), read in the browser so the form itself never has to
// wait for the server or be swapped out while the student is typing.
const noSubscribe = () => () => {};
function useQuery() {
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  return new URLSearchParams(search);
}

// Email first, then password (design board M1). Without JavaScript both steps still work.
export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const query = useQuery();
  // The server checks `next` again; this only decides what goes in the form.
  const next = safeNextPath(query.get("next"));
  const notice = query.get("error") === "link" ? LINK_FAILED : undefined;
  // null until the student acts; then their choice wins. Before that, a server reply with the
  // email filled in means step one is done (this also makes the form work without JavaScript).
  const [step, setStep] = useState<"email" | "password" | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string>();
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "password") passwordRef.current?.focus();
  }, [step]);

  const serverEmailError = state.fieldErrors?.email;
  const onPasswordStep = !serverEmailError && (step ?? (state.email ? "password" : "email")) === "password";
  const emailValue = email ?? state.email ?? "";

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(event) => {
        if (onPasswordStep) return;
        event.preventDefault();
        if (!LOOKS_LIKE_EMAIL.test(emailValue.trim())) {
          setEmailError("Enter a valid email address, like name@example.com.");
          return;
        }
        setEmailError(undefined);
        setStep("password");
      }}
      className="flex w-full flex-col gap-4"
    >
      <input type="hidden" name="next" value={next} />
      <FormAlert message={state.message ?? notice} />

      {onPasswordStep ? (
        <>
          <input type="hidden" name="email" value={emailValue} />
          <p className="flex items-center justify-between gap-3 rounded-full bg-pill px-5 py-3 text-left text-[15px]">
            <span className="truncate">{emailValue}</span>
            <button type="button" onClick={() => { setEmail(emailValue); setStep("email"); }} className="shrink-0 text-sm underline underline-offset-2">
              Change
            </button>
          </p>
          <TextField
            ref={passwordRef}
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            revealable
            required
            error={state.fieldErrors?.password}
          />
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
          <Link href="/forgot-password" className="text-sm">
            Forgot your password?
          </Link>
        </>
      ) : (
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Enter your email"
          required
          value={emailValue}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError ?? serverEmailError}
          end={
            <button
              type="submit"
              aria-label="Continue with email"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink"
            >
              <Icon name="arrowRight" size={18} />
            </button>
          }
        />
      )}
    </form>
  );
}
