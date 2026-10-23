"use client";

import { useState, useTransition } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import type { FieldErrors } from "@/lib/fieldErrors";
import { createInvite } from "@/server/pilot/actions";

// Admin: a new invite code for a group of students (Phase 8).
export function InviteCreateForm() {
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("20");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [result, setResult] = useState<{ ok: boolean; message?: string; fieldErrors?: FieldErrors }>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const created = await createInvite({ label, maxUses, expiresInDays });
          setResult(created);
          if (created.ok) setLabel("");
        });
      }}
    >
      <FormAlert message={result?.message} tone={result?.ok ? "success" : "warning"} />
      <TextField label="Group name" hint="For you only, e.g. “Resit group A”." value={label} onChange={(e) => setLabel(e.target.value)} error={result?.fieldErrors?.label} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="How many students can use it" inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} error={result?.fieldErrors?.maxUses} />
        <TextField label="Stops working after (days)" hint="Leave empty for no end date." inputMode="numeric" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} error={result?.fieldErrors?.expiresInDays} />
      </div>
      <button type="submit" disabled={pending} className={`${compactPrimaryButton} self-start`}>
        {pending ? "Creating…" : "Create invite code"}
      </button>
    </form>
  );
}
