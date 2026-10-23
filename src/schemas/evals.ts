import { z } from "@/lib/zod";

export const evalRunIdSchema = z.uuid({ error: "That test run could not be found." });
export const evalCaseIdSchema = z.string().regex(/^[A-Z][0-9]{2,3}$/, { error: "That test case could not be found." });

export const rateEvalAnswerSchema = z.object({
  id: z.uuid({ error: "That answer could not be found." }),
  rating: z.enum(["approved", "needs_fix"], { error: "Choose Approve or Needs fix." }),
  note: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(2000, { error: "Keep the note to 2000 characters or fewer." })),
});
