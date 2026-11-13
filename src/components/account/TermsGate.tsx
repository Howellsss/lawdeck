"use client";

import { useActionState } from "react";
import { acceptTerms, type TermsState } from "@/server/account/termsActions";
import { FormAlert } from "@/components/ui/FormAlert";
import { primaryButton } from "@/components/ui/buttons";
import { TermsCheckbox } from "./TermsCheckbox";

const initial: TermsState = { status: "idle" };

// "Before you continue": shown once to anyone signed in who has not accepted the current Terms of Service
// and Privacy Notice (for example after Google sign-in, or when the documents change).
export function TermsGate({ terms, privacy }: { terms: string; privacy: string }) {
  const [state, action, pending] = useActionState(acceptTerms, initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="w-full max-w-md rounded-2xl border border-line bg-paper p-6 shadow-xl">
        <h2 id="terms-title" className="font-serif text-2xl text-ink">
          Before you continue
        </h2>
        <p className="mt-2 text-[15px] text-muted">Please read and accept Lawdeck’s Terms of Service and Privacy Notice. We record the date you accept.</p>
        <form action={action} className="mt-5 flex flex-col gap-4">
          <FormAlert message={state.message} />
          <TermsCheckbox terms={terms} privacy={privacy} />
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Saving…" : "Accept and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
