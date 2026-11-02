"use client";

import { useState, useTransition } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { addPilotEmails } from "@/server/pilot/actions";

// Admin: register one or more testers' emails (migration 36).
export function RegisteredEmailForm() {
  const [text, setText] = useState("");
  const [days, setDays] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message?: string }>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const added = await addPilotEmails(text, days);
          setResult(added);
          if (added.ok) setText("");
        });
      }}
    >
      <FormAlert message={result?.message} tone={result?.ok ? "success" : "warning"} />
      <TextAreaField
        label="Testers’ emails"
        hint="The Gmail address they will sign in with. Several at once: one per line, or separated by commas."
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        maxLength={20000}
      />
      <TextField
        label="Access for (days)"
        hint="For example 3. Access starts when each person first gets in and turns off by itself afterwards. Leave empty for no end."
        inputMode="numeric"
        value={days}
        onChange={(event) => setDays(event.target.value.replace(/\D/g, "").slice(0, 2))}
        autoComplete="off"
      />
      <button type="submit" disabled={pending || !text.trim()} className={`${compactPrimaryButton} self-start`}>
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
