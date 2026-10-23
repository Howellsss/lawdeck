import { z } from "@/lib/zod";
import { COURSES } from "@/lib/courses";

// A brief request (Phase 4, step 4f; PRD LN-09): a case or statute named by the student.
export const newBriefSchema = z.object({
  kind: z.enum(["case", "statute"], { error: "Choose case or statute." }),
  name: z
    .string({ error: "Type the name of the case or statute." })
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(3, { error: "Type the name of the case or statute." })
        .max(300, { error: "Names can be up to 300 characters." }),
    ),
  course: z.enum(["all", ...COURSES.map((course) => course.slug)] as [string, ...string[]], { error: "Choose a course." }).default("all"),
});
export type NewBrief = z.infer<typeof newBriefSchema>;

export const briefIdSchema = z.uuid({ error: "That brief could not be found." });

// Claude's reply (rule F-03: checked before use).
export const briefReplySchema = z.object({
  found: z.boolean(),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().max(80),
        covered: z.boolean(),
        text: z.string().trim().max(4000),
        sources: z.array(z.number().int().min(1).max(30)).max(30),
      }),
    )
    .max(12),
});
export type BriefReply = z.infer<typeof briefReplySchema>;
