"use client";

import { useState, useTransition } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import type { FieldErrors } from "@/lib/fieldErrors";
import { savePlanLimits } from "@/server/billing/actions";
import type { PlanRow } from "@/server/billing/plans";

// Admin → Plans: one plan's credits every few hours and a week (migration 74).
export function PlanLimitsForm({ plan }: { plan: PlanRow }) {
  const [windowCredits, setWindow] = useState(plan.windowCredits?.toString() ?? "");
  const [weeklyCredits, setWeekly] = useState(plan.weeklyCredits?.toString() ?? "");
  const [result, setResult] = useState<{ ok: boolean; message?: string; fieldErrors?: FieldErrors }>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      aria-label={`${plan.name} limits`}
      className="flex flex-col gap-3 rounded-lg border border-line p-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => setResult(await savePlanLimits({ planId: plan.id, windowCredits, weeklyCredits })));
      }}
    >
      <h3 className="font-medium">{plan.name}: limits</h3>
      <FormAlert message={result?.message} tone={result?.ok ? "success" : "warning"} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={`Credits every ${plan.windowHours} hours`}
          inputMode="numeric"
          value={windowCredits}
          hint="Refills that long after the first question. Empty: no limit."
          onChange={(event) => setWindow(event.target.value)}
          error={result?.fieldErrors?.windowCredits}
        />
        <TextField
          label="Credits a week"
          inputMode="numeric"
          value={weeklyCredits}
          hint="Weeks count from the day the student paid. Empty: no limit."
          onChange={(event) => setWeekly(event.target.value)}
          error={result?.fieldErrors?.weeklyCredits}
        />
      </div>
      <button type="submit" disabled={pending} className={`${compactSecondaryButton} self-start`}>
        {pending ? "Saving…" : `Save ${plan.name} limits`}
      </button>
    </form>
  );
}
