import { z } from "zod";
import { COURSES } from "@/lib/courses";

export const QUESTION_MAX_CHARS = 2000;

const question = z
  .string({ error: "Type a question." })
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(2, { error: "Type a question." })
      .max(QUESTION_MAX_CHARS, { error: `Questions can be up to ${QUESTION_MAX_CHARS.toLocaleString("en-GB")} characters.` }),
  );

// A question sent to the answer route.
export const askSchema = z.object({ question });

// Starting a chat from the home composer: the course is a slug, or "all".
export const startChatSchema = z.object({
  question,
  course: z.enum(["all", ...COURSES.map((course) => course.slug)] as [string, ...string[]], { error: "Choose a course." }),
});

export const chatIdSchema = z.uuid({ error: "That chat could not be found." });
export const sourceIdSchema = z.uuid({ error: "That source could not be found." });
