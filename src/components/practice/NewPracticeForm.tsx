"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { countLimits, type PracticeKind } from "@/schemas/practice";
import { startPracticeSet } from "@/server/practice/actions";

function counts(kind: PracticeKind): number[] {
  const { min, max } = countLimits(kind);
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

// Choose the type and number of questions or cards; Lawdeck makes them from the library
// (PRD LN-06, LN-07).
export function NewPracticeForm({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [kind, setKind] = useState<PracticeKind>("mcq");
  const cards = kind === "flashcards";

  async function submit(form: FormData) {
    setBusy(true);
    setMessage(undefined);
    const result = await startPracticeSet({
      topicId,
      kind: String(form.get("kind") ?? ""),
      count: String(form.get("count") ?? ""),
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
        <legend className="mb-1 font-medium">Type of practice</legend>
        <label className="flex items-start gap-3">
          <input type="radio" name="kind" value="mcq" checked={kind === "mcq"} onChange={() => setKind("mcq")} className="mt-1" />
          <span>
            Multiple choice
            <span className="block text-sm text-muted">Pick an answer and see at once whether it’s right, and why.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="radio" name="kind" value="scenario" checked={kind === "scenario"} onChange={() => setKind("scenario")} className="mt-1" />
          <span>
            Scenario
            <span className="block text-sm text-muted">A short problem to work through, with a model answer to compare.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="radio" name="kind" value="flashcards" checked={cards} onChange={() => setKind("flashcards")} className="mt-1" />
          <span>
            Flashcards
            <span className="block text-sm text-muted">Quick facts to recall. Mark each one “Know it” or “Not yet”, then review the ones you’re still learning.</span>
          </span>
        </label>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="font-medium">{cards ? "Number of cards" : "Number of questions"}</span>
        <select key={kind} name="count" defaultValue={countLimits(kind).default} className="h-11 w-28 rounded-lg border border-line bg-paper px-3">
          {counts(kind).map((n) => (
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
          {busy ? (cards ? "Making your cards…" : "Making your questions…") : cards ? "Make flashcards" : "Make questions"}
        </button>
        {busy && (
          <span role="status" className="text-sm text-muted">
            This can take up to a minute.
          </span>
        )}
      </div>
      <p className="text-sm text-muted">Each practice set or flashcard set counts as one of your questions this month.</p>
    </form>
  );
}
