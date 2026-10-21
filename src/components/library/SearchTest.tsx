"use client";

import { useState } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { FieldErrors } from "@/lib/fieldErrors";
import type { SearchHit } from "@/server/retrieval/search";
import { testLibrarySearch } from "@/server/retrieval/actions";
import { SearchResults } from "./SearchResults";
import { SelectField } from "./SelectField";

type Outcome = { hits: SearchHit[]; meaningUsed: boolean; reranked: boolean } | null;

// A reviewer types a question and sees the passages search would give an answer.
export function SearchTest({ courses }: { courses: { id: string; name: string }[] }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string>();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(undefined);
    const result = await testLibrarySearch({
      question: String(form.get("question") ?? ""),
      courseId: String(form.get("courseId") ?? ""),
      includePending: form.get("includePending") === "on",
    }).catch(() => ({ ok: false as const, message: "The search did not reach the server. Check your connection." }));
    setBusy(false);
    if (!result.ok) {
      setErrors("fieldErrors" in result ? (result.fieldErrors ?? {}) : {});
      if (result.message) setMessage(result.message);
      return;
    }
    setErrors({});
    setOutcome({ hits: result.hits, meaningUsed: result.meaningUsed, reranked: result.reranked });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
        <FormAlert message={message} />
        <TextField label="Question" name="question" required maxLength={1000} error={errors.question} />
        <SelectField
          label="Course"
          name="courseId"
          error={errors.courseId}
          options={courses.map((course): [string, string] => [course.id, course.name])}
        />
        <label className="flex items-center gap-3 px-1 text-sm">
          <input type="checkbox" name="includePending" defaultChecked className="h-5 w-5 accent-ink" />
          Include material awaiting review (students only ever get approved material)
        </label>
        <div>
          <button type="submit" disabled={busy} className={compactPrimaryButton}>
            {busy ? "Searching…" : "Search"}
          </button>
        </div>
      </form>
      {busy && (
        <p role="status" className="text-sm text-muted">
          Searching…
        </p>
      )}
      {outcome && <SearchResults hits={outcome.hits} meaningUsed={outcome.meaningUsed} reranked={outcome.reranked} />}
    </div>
  );
}
