"use client";

import { useActionState } from "react";
import { checkClaude } from "./actions";

export function HealthCheckForm() {
  const [result, formAction, pending] = useActionState(checkClaude, null);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4 text-left">
      <label htmlFor="code" className="text-sm font-medium">
        Test code
      </label>
      <input
        id="code"
        name="code"
        type="password"
        autoComplete="off"
        required
        className="h-11 rounded-lg border border-line bg-surface px-3 text-base"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg bg-ink px-4 text-base font-medium text-paper disabled:opacity-60"
      >
        {pending ? "Asking Claude…" : "Ask Claude to reply OK"}
      </button>

      <div aria-live="polite" className="min-h-6">
        {result?.ok === true && (
          <div className="rounded-lg border border-line bg-surface p-4 text-left text-sm">
            <p className="font-medium text-success">Connected. Claude replied: “{result.reply}”</p>
            <p className="mt-2 text-muted">
              Model {result.model} · {result.inputTokens} tokens in, {result.outputTokens} out · {result.ms} ms
            </p>
          </div>
        )}
        {result?.ok === false && (
          <p role="alert" className="rounded-lg border border-line bg-surface p-4 text-left text-sm text-warning">
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
