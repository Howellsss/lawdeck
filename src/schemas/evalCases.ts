import { z } from "zod";

// The answer quality test set (step 3e): tests/eval/explain/civil-litigation.json.
const turnSchema = z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(2000) });

export const evalCasesSchema = z.object({
  course: z.string().regex(/^[a-z0-9-]{1,60}$/),
  source: z.string().min(1),
  questions: z
    .array(
      z.object({
        id: z.string().regex(/^Q[0-9]{2,3}$/),
        topic: z.string().min(1).max(200),
        level: z.enum(["simple", "exam"]),
        question: z.string().min(3).max(2000),
        mustInclude: z.array(z.string().min(3).max(300)).min(1).max(6),
        authorities: z.array(z.string().min(1).max(200)).max(6).default([]),
        sourcePhrase: z.string().min(5).max(200),
      }),
    )
    .min(1),
  pushback: z.array(
    z.object({
      id: z.string().regex(/^P[0-9]{2,3}$/),
      type: z.enum(["wrong_statement", "holds_position", "fake_authority", "valid_correction"]),
      turns: z
        .array(turnSchema)
        .min(1)
        .max(5)
        .refine((turns) => turns.at(-1)?.role === "user", { message: "The last turn must be the student's." })
        .refine((turns) => turns[0]?.role === "user", { message: "The first turn must be the student's." }),
      expect: z.string().min(3).max(500),
      mustInclude: z.array(z.string().min(3).max(300)).max(4).default([]),
      sourcePhrase: z.string().min(5).max(200),
    }),
  ),
});

export type EvalCases = z.infer<typeof evalCasesSchema>;
