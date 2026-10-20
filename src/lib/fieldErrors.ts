import type { z } from "zod";

export type FieldErrors = Partial<Record<string, string>>;

// Turns a Zod error into one plain message per form field.
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
