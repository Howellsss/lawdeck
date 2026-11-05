import { z } from "@/lib/zod";

// Students' study actions (docs/specs/remembrance.md, Phase 1b). Checked on the server.
const id = (what: string) => z.uuid({ error: `That ${what} could not be found.` });

export const openSessionSchema = z.object({ topicId: id("topic") });

export const progressSchema = z.object({
  sessionId: id("study session"),
  sectionsRead: z.number().int().min(0).max(200),
  // Seconds of active reading since the last save; the page saves at least every two minutes.
  addSeconds: z.number().int().min(0).max(120),
});

export const revealSchema = z.object({
  checkpointId: id("question"),
  // An open question's answer is shown only after the student has written something, or skipped.
  answer: z.string().trim().max(4000).default(""),
  skipped: z.boolean().default(false),
});

export const answerSchema = z.object({
  sessionId: id("study session").nullable(),
  checkpointId: id("question"),
  context: z.enum(["reading", "test", "revision"]),
  choice: z.number().int().min(0).max(5).nullable().default(null),
  answer: z.string().trim().max(4000).default(""),
  // For open questions the student marks their own answer against the model answer; multiple
  // choice is marked by the server.
  selfOutcome: z.enum(["correct", "partly", "incorrect"]).nullable().default(null),
  skipped: z.boolean().default(false),
});
export type AnswerInput = z.input<typeof answerSchema>;
