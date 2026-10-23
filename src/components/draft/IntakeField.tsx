"use client";

import { useState } from "react";
import type { TemplateField } from "@/schemas/drafting";

const MAX_ENTRIES = 20;
const inputClass = "w-full rounded-lg border border-line bg-paper px-3 text-ink";

// One intake question (DR-04). Several answers are allowed where the template says so (for example
// more than one defendant). Every answer is optional: what is left out stays as a placeholder.
export function IntakeField({ field }: { field: TemplateField }) {
  const [entries, setEntries] = useState([0]);
  const [next, setNext] = useState(1);
  const hintId = `${field.id}-hint`;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-medium">
        {field.label}
        {field.required ? "" : " (optional)"}
      </legend>
      <p id={hintId} className="text-sm text-muted">
        {field.question} If you leave it out, the draft shows <span className="placeholder">[{field.placeholder}]</span>.
      </p>
      {entries.map((key, index) => (
        <div key={key} className="flex items-start gap-2">
          <Input field={field} label={entries.length > 1 ? `${field.label} ${index + 1}` : field.label} hintId={hintId} />
          {entries.length > 1 && (
            <button
              type="button"
              onClick={() => setEntries(entries.filter((k) => k !== key))}
              className="h-11 shrink-0 text-sm underline underline-offset-2"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {field.repeatable && entries.length < MAX_ENTRIES && (
        <button
          type="button"
          onClick={() => {
            setEntries([...entries, next]);
            setNext(next + 1);
          }}
          className="self-start text-sm underline underline-offset-2"
        >
          Add another
        </button>
      )}
    </fieldset>
  );
}

function Input({ field, label, hintId }: { field: TemplateField; label: string; hintId: string }) {
  const common = { name: field.id, "aria-label": label, "aria-describedby": hintId, autoComplete: "off" };
  if (field.type === "date") return <input type="date" {...common} className={`${inputClass} h-11 sm:w-56`} />;
  if (field.type === "longText" || field.type === "address")
    return <textarea {...common} rows={field.type === "address" ? 2 : 4} maxLength={2000} className={`${inputClass} py-2`} />;
  return (
    <input
      type="text"
      inputMode={field.type === "number" ? "numeric" : undefined}
      maxLength={2000}
      {...common}
      className={`${inputClass} h-11`}
    />
  );
}
