"use client";

import { useState, useTransition } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { redeemInvite } from "@/server/pilot/actions";

// A student enters the invite code they were sent (closed pilot, Phase 8).
export function InviteCodeForm() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message?: string }>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => setResult(await redeemInvite(code)));
      }}
    >
      <FormAlert message={result?.message} tone={result?.ok ? "success" : "warning"} />
      <TextField
        label="Invite code"
        hint="10 letters and numbers, from the message that invited you."
        value={code}
        onChange={(event) => setCode(event.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        required
      />
      <button type="submit" disabled={pending} className={`${compactPrimaryButton} self-start`}>
        {pending ? "Checking…" : "Join the pilot"}
      </button>
    </form>
  );
}
