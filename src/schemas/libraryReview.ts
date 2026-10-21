import { z } from "zod";

const REVIEW_STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;

// A reviewer's decision on one library item.
export const reviewDecisionSchema = z
  .object({
    id: z.uuid({ error: "That item could not be found." }),
    status: z.enum(REVIEW_STATUSES, { error: "Choose a decision." }),
    lawCurrentAsOf: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .pipe(z.iso.date({ error: "Enter a date like 2026-09-30." }).nullable()),
    note: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().max(2000, { error: "Use 2,000 characters or fewer." }))
      .transform((value) => (value === "" ? null : value)),
  })
  .refine((decision) => decision.status !== "approved" || decision.lawCurrentAsOf !== null, {
    error: "Enter the date the material is current to before approving it.",
    path: ["lawCurrentAsOf"],
  });

// A reviewer's correction of one passage's wording.
export const passageCorrectionSchema = z.object({
  passageId: z.uuid({ error: "That passage could not be found." }),
  heading: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(500, { error: "Use 500 characters or fewer." }))
    .transform((value) => (value === "" ? null : value)),
  text: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, { error: "A passage cannot be empty." })
        .max(20000, { error: "Use 20,000 characters or fewer." }),
    ),
});

export const reviewPageSchema = z.coerce.number().int().min(1).max(1000).catch(1);
export const reviewStatusFilterSchema = z.enum(REVIEW_STATUSES).optional().catch(undefined);

// The Library list's filter: a review status, or items that need re-checking after a law change.
export const libraryFilterSchema = z.enum([...REVIEW_STATUSES, "recheck"]).optional().catch(undefined);
