"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { PRACTICE_DEFAULT_COUNT, PRACTICE_MAX_COUNT, PRACTICE_MIN_COUNT } from "@/schemas/practice";
import { startPracticeSet } from "@/server/practice/actions";

const COUNTS = Array.from({ length: PRACTICE_MAX_COUNT - PRACTICE_MIN_COUNT + 1 }, (_, i) => PRACTICE_MIN_COUNT + i);

// Choose the type and number of questions; Lawdeck makes them from the library (PRD LN-06).
export function NewPracticeForm({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(form: FormData) {
    setBusy(true);
    setMessage(undefined);
    const result = await startPracticeSet({
      topicId,
      kind: String(form.get("kind") ?? ""),
      count: String(form.get("count") ?? PRACTICE_DEFAULT_COUNT),
    });
    if (result.ok) {
      router.push(`/practice/${result.id}`);
      return;
    }
    setBusy(false);
    setMessage(result.message);
  }

  return (
    <form action={submit} className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Type of question</legend>
        <label className="flex items-start gap-3">
          <input type="radio" name="kind" value="mcq" defaultChecked className="mt-1" />
          <span>
            Multiple choice
            <span className="block text-sm text-muted">Pick an answer and see at once whether it’s right, and why.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="radio" name="kind" value="scenario" className="mt-1" />
          <span>
            Scenario
            <span className="block text-sm text-muted">A short problem to work through, with a model answer to compare.</span>
          </span>
        </label>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="font-medium">Number of questions</span>
        <select name="count" defaultValue={PRACTICE_DEFAULT_COUNT} className="h-11 w-28 rounded-lg border border-line bg-paper px-3">
          {COUNTS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {message && (
        <p role="alert" className="text-sm text-warning">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={compactPrimaryButton}>
          {busy ? "Making your questions…" : "Make questions"}
        </button>
        {busy && (
          <span role="status" className="text-sm text-muted">
            This can take up to a minute.
          </span>
        )}
      </div>
      <p className="text-sm text-muted">Each practice set counts as one of your questions this month.</p>
    </form>
  );
}
