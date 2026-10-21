"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { resendConfirmation, type AuthFormState } from "@/server/auth/actions";
import { FormAlert } from "@/components/ui/FormAlert";
import { secondaryButton } from "@/components/ui/buttons";

// "Check your email" message, with an optional button to send the confirmation link again.
export function CheckEmail({ email, resend, children }: { email: string; resend?: boolean; children: ReactNode }) {
  const [state, formAction, pending] = useActionState(resendConfirmation, { status: "idle" } as AuthFormState);

  return (
    <div role="status" className="flex w-full flex-col gap-4 rounded-3xl border border-line bg-surface p-6 text-left">
      <h2 className="font-serif text-2xl font-medium text-greeting">Check your email</h2>
      <p className="text-[15px] leading-relaxed">
        We sent a link to <strong className="break-all">{email}</strong>. {children}
      </p>
      {resend && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="email" value={email} />
          <FormAlert
            message={state.status === "idle" ? undefined : state.message ?? state.fieldErrors?.email}
            tone={state.status === "sent" ? "success" : "warning"}
          />
          <button type="submit" disabled={pending} className={secondaryButton}>
            {pending ? "Sending…" : "Send the link again"}
          </button>
        </form>
      )}
      <Link href="/sign-in" className="text-sm">
        Back to sign in
      </Link>
    </div>
  );
}
