import { z } from "zod";

// Practice set requests (Phase 4, step 4b; PRD LN-06). Founder's decision: default 5, at most 10.
export const PRACTICE_DEFAULT_COUNT = 5;
export const PRACTICE_MIN_COUNT = 3;
export const PRACTICE_MAX_COUNT = 10;

export const newPracticeSetSchema = z.object({
  topicId: z.uuid({ error: "Choose a topic." }),
  kind: z.enum(["mcq", "scenario"], { error: "Choose multiple choice or scenario." }),
  count: z.coerce
    .number({ error: "Choose how many questions." })
    .int({ error: "Choose how many questions." })
    .min(PRACTICE_MIN_COUNT, { error: `Choose at least ${PRACTICE_MIN_COUNT} questions.` })
    .max(PRACTICE_MAX_COUNT, { error: `Choose at most ${PRACTICE_MAX_COUNT} questions.` })
    .default(PRACTICE_DEFAULT_COUNT),
});
export type NewPracticeSet = z.infer<typeof newPracticeSetSchema>;

export const practiceSetIdSchema = z.uuid({ error: "That practice set could not be found." });

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
