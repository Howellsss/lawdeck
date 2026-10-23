"use client";

import { useState, useTransition } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import type { FieldErrors } from "@/lib/fieldErrors";
import { savePilotSettings } from "@/server/pilot/actions";

// Admin: invite-only on or off, and the price question (Phase 8).
export function PilotSettingsForm({ initial }: { initial: { inviteOnly: boolean; priceNgn: number | null; priceQuestionOpen: boolean } }) {
  const [inviteOnly, setInviteOnly] = useState(initial.inviteOnly);
  const [priceQuestionOpen, setPriceQuestionOpen] = useState(initial.priceQuestionOpen);
  const [priceNgn, setPriceNgn] = useState(initial.priceNgn?.toString() ?? "");
  const [result, setResult] = useState<{ ok: boolean; message?: string; fieldErrors?: FieldErrors }>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => setResult(await savePilotSettings({ inviteOnly, priceQuestionOpen, priceNgn })));
      }}
    >
      <FormAlert message={result?.message} tone={result?.ok ? "success" : "warning"} />
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-5" checked={inviteOnly} onChange={(event) => setInviteOnly(event.target.checked)} />
        <span>
          <span className="font-medium">Invite only</span>
          <span className="block text-sm text-muted">New students need an invite code before they can ask questions or have scans read. Reviewers and admins are not affected.</span>
        </span>
      </label>
      <TextField
        label="Price to test (naira a month)"
        hint="Asked as: “Would you pay ₦… a month for Lawdeck?”"
        inputMode="numeric"
        value={priceNgn}
        onChange={(event) => setPriceNgn(event.target.value)}
        error={result?.fieldErrors?.priceNgn}
      />
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-5" checked={priceQuestionOpen} onChange={(event) => setPriceQuestionOpen(event.target.checked)} />
        <span>
          <span className="font-medium">Ask the price question</span>
          <span className="block text-sm text-muted">Pilot students see it once on the home page. Changing the price asks everyone again.</span>
        </span>
      </label>
      <button type="submit" disabled={pending} className={`${compactPrimaryButton} self-start`}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
