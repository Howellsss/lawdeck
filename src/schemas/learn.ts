import { z } from "@/lib/zod";
import { COURSES } from "@/lib/courses";

// Long enough for any exam problem question (about 3,000 words; founder asked for the highest
// sensible limit, 2026-10-25). Longer text would cost more and search less well.
export const QUESTION_MAX_CHARS = 20000;

const question = z
  .string({ error: "Type a question." })
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(2, { error: "Type a question." })
      .max(QUESTION_MAX_CHARS, { error: `Questions can be up to ${QUESTION_MAX_CHARS.toLocaleString("en-GB")} characters.` }),
  );

export const levelSchema = z.enum(["simple", "exam"]).default("exam");

// A question sent to the answer route, with the answer level (PRD LN-02).
export const askSchema = z.object({ question, level: levelSchema });

// Starting a chat from the home composer or a course hub: the course is a slug, or "all".
// "auto" asks the router whether it is a Learn or a Draft request (PRD WS-03).
export const startChatSchema = z.object({
  question,
  course: z.enum(["all", ...COURSES.map((course) => course.slug)] as [string, ...string[]], { error: "Choose a course." }),
  mode: z.enum(["auto", "learn"]).default("learn"),
});

export const chatIdSchema = z.uuid({ error: "That chat could not be found." });
export const sourceIdSchema = z.uuid({ error: "That source could not be found." });

// Shown when Auto mode treats a request as Draft, until drafting arrives (Phase 5).
export const DRAFT_ROUTED = "This looks like a request to draft a document.";

// A course topic's name (curriculum structure only, never legal content: rule H-01).
export const topicNameSchema = z
  .string({ error: "Enter a topic name." })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(2, { error: "Enter a topic name." }).max(160, { error: "Use 160 characters or fewer." }));

export const topicIdSchema = z.uuid({ error: "That topic could not be found." });

// A topic's web address part, made from its name: "Service of Process" → "service-of-process".
export function topicSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72)
      .replace(/-+$/, "") || "topic"
  );
}
