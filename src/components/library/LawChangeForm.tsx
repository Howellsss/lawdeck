"use client";

import { useRef, useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { compactPrimaryButton } from "@/components/ui/buttons";
import type { FieldErrors } from "@/lib/fieldErrors";
import { addLawChange } from "@/server/library/lawChangeActions";
import { SelectField } from "./SelectField";

// Record a change in the law (new rules, an amended statute, a practice direction).
export function LawChangeForm({ courses }: { courses: { id: string; name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<{ tone: "success" | "warning"; message: string }>();
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");
    startTransition(async () => {
      const saved = await addLawChange({
        courseId: text("courseId"),
        title: text("title"),
        effectiveOn: text("effectiveOn"),
        note: text("note"),
        source: text("source"),
      });
      setErrors(saved.ok ? {} : (saved.fieldErrors ?? {}));
      setResult(saved.message ? { tone: saved.ok ? "success" : "warning", message: saved.message } : undefined);
      if (saved.ok) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-lg font-medium">Record a change</h2>
      <FormAlert message={result?.message} tone={result?.tone} />
      <TextField
        label="What changed"
        name="title"
        maxLength={300}
        required
        placeholder="e.g. Civil Procedure Rules 2024: Order 2 amended"
        error={errors.title}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Course"
          name="courseId"
          error={errors.courseId}
          options={courses.map((course): [string, string] => [course.id, course.name])}
        />
        <TextField label="Took effect on" name="effectiveOn" type="date" required error={errors.effectiveOn} />
      </div>
      <TextField label="Source (optional)" name="source" maxLength={500} hint="e.g. the gazette or practice direction." error={errors.source} />
      <TextField label="Note (optional)" name="note" maxLength={2000} error={errors.note} />
      <div>
        <button type="submit" disabled={pending} className={compactPrimaryButton}>
          {pending ? "Saving…" : "Record change"}
        </button>
      </div>
    </form>
  );
}
