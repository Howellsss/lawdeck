import { z } from "@/lib/zod";

// "Mark my answer" (Phase 4, step 4e; PRD LN-08). Typed answers only for now; uploads come with
// the upload safety work in Phase 6 (founder, 2026-10-22).
export const ANSWER_MIN_CHARS = 30;
export const ANSWER_MAX_CHARS = 20_000;

export const markAnswerSchema = z.object({
  rubricId: z.uuid({ error: "That question could not be found." }),
  answer: z
    .string({ error: "Write your answer first." })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(ANSWER_MIN_CHARS, { error: `Write at least ${ANSWER_MIN_CHARS} characters so there is something to mark.` })
        .max(ANSWER_MAX_CHARS, { error: `Answers can be up to ${ANSWER_MAX_CHARS.toLocaleString("en-GB")} characters.` }),
    ),
});

// Claude's marking (rule F-03: checked before use).
export const markingReplySchema = z.object({
  points: z
    .array(
      z.object({
        number: z.number().int().min(1).max(30),
        awarded: z.number().int().min(0).max(20),
        good: z.string().trim().max(2000),
        missing: z.string().trim().max(2000),
      }),
    )
    .max(30),
  correctRule: z.string().trim().max(6000),
  overall: z.string().trim().max(2000),
});
export type MarkingReply = z.infer<typeof markingReplySchema>;

// What is saved with the attempt and shown to the student.
export type MarkingFeedback = {
  points: { point: string; max: number; awarded: number; good: string; missing: string }[];
  total: number;
  max: number;
  correctRule: string;
  overall: string;
  sources: { label: number; title: string; heading: string | null; pages: string | null }[];
};

export function parseFeedback(value: unknown): MarkingFeedback | null {
  if (!value || typeof value !== "object") return null;
  const f = value as Record<string, unknown>;
  if (!Array.isArray(f.points) || typeof f.total !== "number" || typeof f.max !== "number") return null;
  const points = f.points.flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const { point, max, awarded, good, missing } = p as Record<string, unknown>;
    return typeof point === "string" && typeof max === "number" && typeof awarded === "number"
      ? [{ point, max, awarded, good: typeof good === "string" ? good : "", missing: typeof missing === "string" ? missing : "" }]
      : [];
  });
  const sources = Array.isArray(f.sources)
    ? f.sources.flatMap((s) => {
        if (!s || typeof s !== "object") return [];
        const { label, title, heading, pages } = s as Record<string, unknown>;
        return typeof label === "number" && typeof title === "string"
          ? [{ label, title, heading: typeof heading === "string" ? heading : null, pages: typeof pages === "string" ? pages : null }]
          : [];
      })
    : [];
  return {
    points,
    total: f.total,
    max: f.max,
    correctRule: typeof f.correctRule === "string" ? f.correctRule : "",
    overall: typeof f.overall === "string" ? f.overall : "",
    sources,
  };
}
