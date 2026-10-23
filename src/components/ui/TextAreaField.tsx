"use client";

import { useId, type TextareaHTMLAttributes } from "react";

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> & {
  label: string;
  hint?: string;
  error?: string;
};

// A labelled multi-line box with an optional hint and error, linked for screen readers; the
// same look as TextField.
export function TextAreaField({ label, hint, error, rows = 4, ...textarea }: TextAreaFieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={id} className="px-1 text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`rounded-3xl border bg-sidebar px-5 py-3 text-[17px] text-ink outline-none placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-ink ${
          error ? "border-warning" : "border-line"
        }`}
        {...textarea}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="px-1 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="px-1 text-sm text-warning">
          {error}
        </p>
      )}
    </div>
  );
}
