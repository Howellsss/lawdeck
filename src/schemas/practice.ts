import { z } from "@/lib/zod";

// Practice set requests (Phase 4; PRD LN-06, LN-07). Founder's decisions: questions default 5,
// at most 10; flashcards default 10, at most 20.
export const PRACTICE_DEFAULT_COUNT = 5;
export const PRACTICE_MIN_COUNT = 3;
export const PRACTICE_MAX_COUNT = 10;
export const FLASHCARD_DEFAULT_COUNT = 10;
export const FLASHCARD_MIN_COUNT = 5;
export const FLASHCARD_MAX_COUNT = 20;

export type PracticeKind = "mcq" | "scenario" | "flashcards";

export function countLimits(kind: PracticeKind): { min: number; max: number; default: number } {
  return kind === "flashcards"
    ? { min: FLASHCARD_MIN_COUNT, max: FLASHCARD_MAX_COUNT, default: FLASHCARD_DEFAULT_COUNT }
    : { min: PRACTICE_MIN_COUNT, max: PRACTICE_MAX_COUNT, default: PRACTICE_DEFAULT_COUNT };
}

export const newPracticeSetSchema = z
  .object({
    topicId: z.uuid({ error: "Choose a topic." }),
    kind: z.enum(["mcq", "scenario", "flashcards"], { error: "Choose multiple choice, scenario or flashcards." }),
    count: z.union([z.literal(""), z.coerce.number({ error: "Choose how many." }).int({ error: "Choose how many." })]).optional(),
  })
  .transform((value, ctx) => {
    const limits = countLimits(value.kind);
    const count = value.count === undefined || value.count === "" ? limits.default : value.count;
    const noun = value.kind === "flashcards" ? "cards" : "questions";
    if (count < limits.min || count > limits.max) {
      ctx.addIssue({ code: "custom", message: `Choose between ${limits.min} and ${limits.max} ${noun}.`, path: ["count"] });
      return z.NEVER;
    }
    return { topicId: value.topicId, kind: value.kind, count };
  });
export type NewPracticeSet = z.infer<typeof newPracticeSetSchema>;

export const practiceSetIdSchema = z.uuid({ error: "That practice set could not be found." });

export const flashcardMarkSchema = z.object({
  itemId: z.uuid({ error: "That card could not be found." }),
  known: z.boolean().nullable(),
});

export const mcqAnswerSchema = z.object({
  itemId: z.uuid({ error: "That question could not be found." }),
  choice: z.coerce.number().int().min(0).max(5),
});

// Claude's reply (rule F-03: checked before use). Lengths match the database's own limits.
export const practiceReplySchema = z.object({
  notEnough: z.boolean(),
  items: z
    .array(
      z.object({
        question: z.string().trim().min(5).max(4000),
        choices: z.array(z.string().trim().min(1).max(500)).max(6),
        correctChoice: z.number().int().min(-1).max(5),
        answer: z.string().trim().min(5).max(8000),
        sources: z.array(z.number().int().min(1).max(30)).max(30),
      }),
    )
    .max(20),
});
export type PracticeReply = z.infer<typeof practiceReplySchema>;
