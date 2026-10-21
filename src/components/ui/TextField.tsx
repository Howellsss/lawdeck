"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  label: string;
  hint?: string;
  error?: string;
  revealable?: boolean;
  // A button shown inside the rounded box, after the text (e.g. the "continue" arrow).
  end?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

const inputBox =
  "flex h-14 items-center gap-2 rounded-full border bg-sidebar pl-5 pr-1.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink";

// A labelled input with an optional hint and error, linked for screen readers.
// `revealable` adds a Show/Hide button for passwords.
export function TextField({ label, hint, error, revealable, end, type = "text", ...input }: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={id} className="px-1 text-sm font-medium">
        {label}
      </label>
      <div className={`${inputBox} ${error ? "border-warning" : "border-line"}`}>
        <input
          id={id}
          type={revealable && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-muted"
          {...input}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-pressed={revealed}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="mr-2 rounded-full px-2 py-1 text-sm text-muted underline underline-offset-2 hover:text-ink"
          >
            {revealed ? "Hide" : "Show"}
          </button>
        )}
        {end}
      </div>
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
