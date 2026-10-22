"use client";

import { RUBRIC_MAX_MARKS, RUBRIC_MAX_POINTS } from "@/schemas/rubrics";

export type PointRow = { point: string; marks: number };

// The marking points: what a good answer must say, and the marks for each.
export function RubricPoints({ points, onChange }: { points: PointRow[]; onChange: (points: PointRow[]) => void }) {
  const update = (index: number, change: Partial<PointRow>) => onChange(points.map((p, i) => (i === index ? { ...p, ...change } : p)));
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 font-medium">Marking points</legend>
      <ol className="flex flex-col gap-3">
        {points.map((row, index) => (
          <li key={index} className="flex flex-col gap-2 rounded-xl border border-line bg-paper p-3 sm:flex-row sm:items-start">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-muted">Point {index + 1}: what a good answer says</span>
              <textarea
                value={row.point}
                onChange={(e) => update(index, { point: e.target.value })}
                rows={2}
                maxLength={500}
                className="rounded-lg border border-line bg-surface px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 sm:w-24">
              <span className="text-sm text-muted">Marks</span>
              <input
                type="number"
                min={1}
                max={RUBRIC_MAX_MARKS}
                value={row.marks}
                onChange={(e) => update(index, { marks: Number(e.target.value) })}
                className="h-11 rounded-lg border border-line bg-surface px-3"
              />
            </label>
            {points.length > 1 && (
              <button type="button" onClick={() => onChange(points.filter((_, i) => i !== index))} className="self-start text-sm underline underline-offset-2 sm:mt-6">
                Remove<span className="sr-only"> point {index + 1}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      {points.length < RUBRIC_MAX_POINTS && (
        <button type="button" onClick={() => onChange([...points, { point: "", marks: 1 }])} className="self-start text-sm underline underline-offset-2">
          Add a marking point
        </button>
      )}
    </fieldset>
  );
}
