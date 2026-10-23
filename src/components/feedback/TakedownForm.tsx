"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { primaryButton } from "@/components/ui/buttons";
import { TAKEDOWN_DAYS } from "@/schemas/feedback";
import { submitTakedown, type TakedownState } from "@/server/feedback/actions";

const INITIAL: TakedownState = { status: "idle" };

// Anyone can ask for material to be removed from Lawdeck (PRD FB-03).
export function TakedownForm() {
  const [state, action, pending] = useActionState(submitTakedown, INITIAL);
  if (state.status === "sent")
    return (
      <div role="status" className="flex flex-col gap-2 text-center">
        <h2 className="font-serif text-2xl font-normal text-greeting">Request received</h2>
        <p className="text-muted">
          Thank you. The Lawdeck team will look at it and act within {TAKEDOWN_DAYS} days. We may email you if we need more detail.
        </p>
      </div>
    );
  return (
    <form action={action} noValidate className="flex w-full flex-col gap-4">
      <FormAlert message={state.message} />
      <TextField label="Your name" name="name" autoComplete="name" maxLength={120} required error={state.fieldErrors?.name} />
      <TextField
        label="Your email address"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        required
        error={state.fieldErrors?.email}
      />
      <TextAreaField
        label="What should be removed?"
        name="material"
        maxLength={2000}
        hint="Say where it appears in Lawdeck and what it is (for example, the title of a document or passage)."
        required
        error={state.fieldErrors?.material}
      />
      <TextAreaField
        label="Why should it be removed?"
        name="reason"
        maxLength={4000}
        hint="For example, it is your copyright, or it is about you."
        required
        error={state.fieldErrors?.reason}
      />
      {/* A trap for spam robots: hidden from people and screen readers. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
