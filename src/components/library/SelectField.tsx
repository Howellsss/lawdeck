"use client";

import { useId } from "react";

// A labelled dropdown that matches the text fields.
export function SelectField({
  label,
  name,
  options,
  error,
}: {
  label: string;
  name: string;
  options: [string, string][];
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="px-1 text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue=""
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`h-14 rounded-full border bg-sidebar px-5 text-[17px] text-ink ${error ? "border-warning" : "border-line"}`}
      >
        <option value="" disabled>
          Choose…
        </option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="px-1 text-sm text-warning">
          {error}
        </p>
      )}
    </div>
  );
}
