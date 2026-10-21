import { z } from "zod";

// A change in the law recorded by a reviewer (rule KB-02).
export const lawChangeSchema = z.object({
  courseId: z.uuid({ error: "Choose a course." }),
  title: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, { error: "Describe the change." }).max(300, { error: "Use 300 characters or fewer." })),
  effectiveOn: z.iso.date({ error: "Enter the date it took effect, like 2024-03-01." }),
  note: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(2000, { error: "Use 2,000 characters or fewer." }))
    .transform((value) => (value === "" ? null : value)),
  source: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(500, { error: "Use 500 characters or fewer." }))
    .transform((value) => (value === "" ? null : value)),
});

export const lawChangeIdSchema = z.uuid({ error: "That change could not be found." });
