"use client";

import { useState, useTransition } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import type { FieldErrors } from "@/lib/fieldErrors";
import { savePlan } from "@/server/billing/actions";
import type { PlanRow } from "@/server/billing/plans";

// Admin → Plans: one plan's monthly price and credits (migration 68).
export function PlanPriceForm({ plan }: { plan: PlanRow }) {
  const [price, setPrice] = useState(plan.priceNgn.toString());
  const [credits, setCredits] = useState(plan.credits?.toString() ?? "");
  const [result, setResult] = useState<{ ok: boolean; message?: string; fieldErrors?: FieldErrors }>();
  const [pending, startTransition] = useTransition();
  const free = plan.name === "Free";

  return (
    <form
      aria-label={`${plan.name} plan`}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => setResult(await savePlan({ planId: plan.id, price, credits })));
      }}
    >
      <h2 className="text-lg font-medium">{plan.name}</h2>
      <FormAlert message={result?.message} tone={result?.ok ? "success" : "warning"} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Price a month (₦)"
          inputMode="numeric"
          value={price}
          disabled={free}
          hint={free ? "The Free plan stays free." : "For example 3999"}
          onChange={(event) => setPrice(event.target.value)}
          error={result?.fieldErrors?.price}
        />
        <TextField
          label="Credits a month"
          inputMode="numeric"
          value={credits}
          hint="An ordinary answer is 1 credit"
          onChange={(event) => setCredits(event.target.value)}
          error={result?.fieldErrors?.credits}
        />
      </div>
      <button type="submit" disabled={pending} className={`${compactPrimaryButton} self-start`}>
        {pending ? "Saving…" : `Save ${plan.name}`}
      </button>
    </form>
  );
}
