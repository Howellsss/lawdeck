"use client";

import { TextField } from "@/components/ui/TextField";
import type { FieldErrors } from "@/lib/fieldErrors";
import { KB_ITEM_TYPES } from "@/lib/libraryLabels";
import { SelectField } from "./SelectField";

export type DriveRow = {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  title: string;
  courseId: string;
  year: string;
  status: "ready" | "importing" | "reading" | "done" | "skipped" | "failed";
  message?: string;
  errors?: FieldErrors;
};

const STATUS_TONE = { ready: "text-muted", importing: "text-muted", reading: "text-muted", done: "text-success", skipped: "text-muted", failed: "text-warning" } as const;

// One picked file: its suggested details (editable) and how its import is going.
export function DriveFileRow({
  row,
  index,
  courses,
  disabled,
}: {
  row: DriveRow;
  index: number;
  courses: { id: string; name: string }[];
  disabled: boolean;
}) {
  const locked = disabled || row.status === "done" || row.status === "skipped";
  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <p className="break-words text-sm text-muted">
        {row.fileName} · {(row.sizeBytes / (1024 * 1024)).toFixed(1)} MB
      </p>
      <fieldset disabled={locked} className="flex flex-col gap-3">
        <legend className="sr-only">Details for {row.fileName}</legend>
        <TextField label="Title" name={`title-${index}`} defaultValue={row.title} maxLength={300} error={row.errors?.title} />
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField
            label="Course"
            name={`courseId-${index}`}
            defaultValue={row.courseId}
            error={row.errors?.courseId}
            options={courses.map((course): [string, string] => [course.id, course.name])}
          />
          <SelectField
            label="Type"
            name={`type-${index}`}
            defaultValue="course_material"
            error={row.errors?.type}
            options={Object.entries(KB_ITEM_TYPES)}
          />
          <TextField label="Year" name={`year-${index}`} defaultValue={row.year} inputMode="numeric" maxLength={4} error={row.errors?.year} />
        </div>
      </fieldset>
      {row.message && (
        <p role={row.status === "failed" ? "alert" : "status"} className={`text-sm ${STATUS_TONE[row.status]}`}>
          {row.message}
        </p>
      )}
    </li>
  );
}
