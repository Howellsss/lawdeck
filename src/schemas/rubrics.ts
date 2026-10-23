import { z } from "@/lib/zod";

// Marking guides (Phase 4, step 4d): one exam-style question with the points a good answer makes,
// each worth some marks. Written and approved by reviewers; used to mark students in step 4e.
export const RUBRIC_MAX_POINTS = 30;
export const RUBRIC_MAX_MARKS = 20;

const text = (min: number, max: number, empty: string) =>
  z
    .string({ error: empty })
    .transform((value) => value.trim())
    .pipe(z.string().min(min, { error: empty }).max(max, { error: `Use ${max.toLocaleString("en-GB")} characters or fewer.` }));

export const rubricPointSchema = z.object({
  point: text(3, 500, "Write what a good answer must say."),
  marks: z.coerce
    .number({ error: "Give the marks." })
    .int({ error: "Marks are whole numbers." })
    .min(1, { error: "At least 1 mark." })
    .max(RUBRIC_MAX_MARKS, { error: `At most ${RUBRIC_MAX_MARKS} marks.` }),
});

export const rubricSchema = z.object({
  id: z.uuid().optional(),
  courseId: z.uuid({ error: "Choose a course." }),
  topicId: z.union([z.uuid(), z.literal("")]).transform((value) => value || null),
  title: text(3, 200, "Give the guide a short title."),
  question: text(10, 6000, "Write the exam-style question."),
  criteria: z
    .array(rubricPointSchema)
    .min(1, { error: "Add at least one marking point." })
    .max(RUBRIC_MAX_POINTS, { error: `At most ${RUBRIC_MAX_POINTS} marking points.` }),
});
export type RubricInput = z.input<typeof rubricSchema>;

export const rubricIdSchema = z.uuid({ error: "That marking guide could not be found." });
export const rubricStatusSchema = z.enum(["approved", "pending", "withdrawn"]);

// What the screens call each status.
export const RUBRIC_STATUS_LABELS = { pending: "Draft", approved: "Approved", withdrawn: "Withdrawn", rejected: "Rejected" } as const;

export function totalMarks(criteria: { marks: number }[]): number {
  return criteria.reduce((sum, point) => sum + (Number.isFinite(point.marks) ? point.marks : 0), 0);
}

// The marking points saved with a guide, read back safely.
export function parseCriteria(value: unknown): { point: string; marks: number }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { point, marks } = entry as Record<string, unknown>;
    return typeof point === "string" && typeof marks === "number" ? [{ point, marks }] : [];
  });
}
