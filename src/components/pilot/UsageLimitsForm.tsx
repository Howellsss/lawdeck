"use client";

import { useState, useTransition } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import type { FieldErrors } from "@/lib/fieldErrors";
import type { UsageLimits } from "@/server/db/pilot";
import { saveUsageLimits } from "@/server/pilot/actions";

const asText = (value: number | null) => value?.toString() ?? "";

// Admin: limits for a public test (migration 35), so the AI credit cannot run out. Questions are
// every AI request: explanations, practice, briefs, marking and drafts. Empty means no extra limit;
// reviewers and admins are never limited.
export function UsageLimitsForm({ initial }: { initial: UsageLimits }) {
  const [values, setValues] = useState({
    burstLimit: asText(initial.burstLimit),
    burstHours: asText(initial.burstHours),
    monthlyQuestionCap: asText(initial.monthlyQuestionCap),
    monthlyScanPageCap: asText(initial.monthlyScanPageCap),
  });
  const [result, setResult] = useState<{ ok: boolean; message?: string; fieldErrors?: FieldErrors }>();
  const [pending, startTransition] = useTransition();
  const field = (key: keyof typeof values) => ({
    inputMode: "numeric" as const,
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: event.target.value }),
    error: result?.fieldErrors?.[key],
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => setResult(await saveUsageLimits(values)));
      }}
    >
      <FormAlert message={result?.message} tone={result?.ok ? "success" : "warning"} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Questions per short period" hint="For example 5" {...field("burstLimit")} />
        <TextField label="Short period, in hours" hint="For example 3" {...field("burstHours")} />
        <TextField label="Questions per month, at most" hint="For example 25. Replaces the plan’s 30 while set." {...field("monthlyQuestionCap")} />
        <TextField label="Scanned pages per month, at most" hint="For example 20. Replaces the plan’s 200 while set." {...field("monthlyScanPageCap")} />
      </div>
      <button type="submit" disabled={pending} className={`${compactPrimaryButton} self-start`}>
        {pending ? "Saving…" : "Save limits"}
      </button>
    </form>
  );
}
