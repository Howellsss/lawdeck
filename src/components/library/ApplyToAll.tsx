"use client";

import { useState } from "react";
import { compactSecondaryButton } from "@/components/ui/buttons";
import { KB_ITEM_TYPES } from "@/lib/libraryLabels";

export type AllDetails = { courseId?: string; type?: string; year?: string };

// "Apply to all" (founder, 2026-11-08): set the course, type or year once for every file below.
// Each file can still be changed on its own afterwards.
export function ApplyToAll({ courses, disabled, onApply }: { courses: { id: string; name: string }[]; disabled: boolean; onApply: (details: AllDetails) => void }) {
  const [courseId, setCourseId] = useState("");
  const [type, setType] = useState("");
  const [year, setYear] = useState("");
  const field = "h-11 rounded-lg border border-line bg-paper px-2 text-[15px] font-normal";
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2 rounded-2xl border border-line p-4">
      <legend className="px-1 text-sm font-medium">Apply to all files</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Course
          <select aria-label="Course for all files" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={field}>
            <option value="">Keep each file&rsquo;s</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select aria-label="Type for all files" value={type} onChange={(e) => setType(e.target.value)} className={field}>
            <option value="">Keep each file&rsquo;s</option>
            {Object.entries(KB_ITEM_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Year
          <input aria-label="Year for all files" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Keep each file’s" className={`${field} px-3`} />
        </label>
      </div>
      <div>
        <button
          type="button"
          onClick={() => onApply({ courseId: courseId || undefined, type: type || undefined, year: year || undefined })}
          disabled={!courseId && !type && !year}
          className={compactSecondaryButton}
        >
          Apply to all
        </button>
      </div>
    </fieldset>
  );
}
