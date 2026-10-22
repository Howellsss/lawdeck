"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { COURSES } from "@/lib/courses";
import { startBrief } from "@/server/briefs/actions";

// Name a case or statute; Lawdeck briefs it from the library (PRD LN-09).
export function NewBriefForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [kind, setKind] = useState<"case" | "statute">("case");

  async function submit(form: FormData) {
    setBusy(true);
    setMessage(undefined);
    const result = await startBrief({ kind, name: String(form.get("name") ?? ""), course: String(form.get("course") ?? "all") });
    if (result.ok) {
      router.push(`/briefs/${result.id}`);
      return;
    }
    setBusy(false);
    setMessage(result.message);
  }

  return (
    <form action={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="mb-2 font-medium">Brief a</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="case" checked={kind === "case"} onChange={() => setKind("case")} />
          Case
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="statute" checked={kind === "statute"} onChange={() => setKind("statute")} />
          Statute or rules of court
        </label>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="font-medium">{kind === "case" ? "Name of the case" : "Name of the statute or rules"}</span>
        <input
          name="name"
          required
          minLength={3}
          maxLength={300}
          autoComplete="off"
          placeholder={kind === "case" ? "Both parties, for example: A v. B" : "Full title, with the year if you know it"}
          className="h-11 rounded-lg border border-line bg-paper px-3"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-medium">Course</span>
        <select name="course" defaultValue="all" className="h-11 rounded-lg border border-line bg-paper px-3 sm:w-72">
          <option value="all">All courses</option>
          {COURSES.map((course) => (
            <option key={course.slug} value={course.slug}>
              {course.name}
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
          {busy ? "Writing the brief…" : "Write brief"}
        </button>
        {busy && (
          <span role="status" className="text-sm text-muted">
            This can take up to a minute.
          </span>
        )}
      </div>
      <p className="text-sm text-muted">Briefs come only from approved course material. Each brief counts as one of your questions this month.</p>
    </form>
  );
}
