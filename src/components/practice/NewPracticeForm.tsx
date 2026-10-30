"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { Spinner } from "@/components/ui/Spinner";
import { countLimits } from "@/schemas/practice";
import { startPracticeSet } from "@/server/practice/actions";

const COUNTS = (() => {
  const { min, max } = countLimits("mcq");
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
})();

// Multiple-choice questions (MCQ) on one topic, made from the library (PRD LN-06). Founder,
// 2026-10-30: practice is MCQ, and pressing Create questions shows at once that it is working,
// as drafting does. Sent by hand rather than as a form action, so a refusal keeps the choice.
export function NewPracticeForm({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(undefined);
    let result: Awaited<ReturnType<typeof startPracticeSet>>;
    try {
      result = await startPracticeSet({ topicId, kind: "mcq", count: String(form.get("count") ?? "") });
    } catch {
      setBusy(false);
      setMessage("Lawdeck could not finish your questions. Check your connection and press Create questions again.");
      return;
    }
    if (result.ok) {
      router.push(`/practice/${result.id}`);
      return;
    }
    setBusy(false);
    setMessage(result.message);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <p className="text-muted">Pick an answer to each question and see at once whether it’s right, and why.</p>
      <label className="flex flex-col gap-2">
        <span className="font-medium">Number of questions</span>
        <select name="count" defaultValue={countLimits("mcq").default} disabled={busy} className="h-11 w-28 rounded-lg border border-line bg-paper px-3">
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
          {busy ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Creating questions…
            </span>
          ) : (
            "Create questions"
          )}
        </button>
        {busy && (
          <span role="status" className="text-sm text-muted">
            Writing your questions from the course material. This can take up to a minute.
          </span>
        )}
      </div>
      <p className="text-sm text-muted">Each MCQ set counts as one of your questions this month.</p>
    </form>
  );
}
