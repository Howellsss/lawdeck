import { z } from "@/lib/zod";

// Topic Lessons (docs/specs/remembrance.md). Two shapes: what Claude replies (checked before use,
// rule F-03), and what is saved in topic_lessons.content (checked again before display).

export const MARK_TYPES = ["case", "principle", "statute", "tip", "exception", "definition"] as const;
export type MarkType = (typeof MARK_TYPES)[number];

export const CHECKPOINT_KINDS = ["mcq", "short", "open", "authority", "statute", "principle", "sequence"] as const;
export type CheckpointKind = (typeof CHECKPOINT_KINDS)[number];

const sourceIds = z.array(z.number().int().min(1).max(99)).max(20);

// Claude's reply. Marks name a phrase in the paragraph; Lawdeck finds it and places the mark.
// Each part has its own schema so one faulty part can be dropped without losing the lesson
// (src/lib/replySalvage.ts).
export const lessonReplyMarkSchema = z.object({
  type: z.enum(MARK_TYPES),
  phrase: z.string().trim().min(1).max(300),
  authority: z.string().trim().max(60).optional().default(""),
});
export const lessonReplyParagraphSchema = z.object({
  text: z.string().trim().min(1).max(3000),
  sources: sourceIds,
  marks: z.array(lessonReplyMarkSchema).max(12),
});
export const lessonReplySectionSchema = z.object({
  heading: z.string().trim().min(1).max(160),
  paragraphs: z.array(lessonReplyParagraphSchema).min(1).max(12),
});
export const lessonReplyAuthoritySchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9-]{1,60}$/),
  kind: z.enum(["case", "statute"]),
  name: z.string().trim().min(2).max(300),
  citation: z.string().trim().max(300),
  court: z.string().trim().max(200),
  facts: z.string().trim().max(4000),
  issue: z.string().trim().max(2000),
  decision: z.string().trim().max(2000),
  principle: z.string().trim().min(2).max(2000),
  facts_from_library: z.boolean(),
  sources: sourceIds,
});
export const lessonReplyCheckpointSchema = z.object({
  after_section: z.number().int().min(0).max(13),
  placement: z.enum(["reading", "test"]),
  kind: z.enum(CHECKPOINT_KINDS),
  prompt: z.string().trim().min(3).max(2000),
  choices: z.array(z.string().trim().min(1).max(500)).max(6),
  correct_choice: z.number().int().min(-1).max(5),
  answer: z.string().trim().min(1).max(4000),
  explanation: z.string().trim().max(4000),
  key_point: z.string().trim().min(2).max(200),
  sources: sourceIds,
});
export const lessonReplySchema = z.object({
  found: z.boolean(),
  title: z.string().trim().max(200),
  sections: z.array(lessonReplySectionSchema).max(14),
  authorities: z.array(lessonReplyAuthoritySchema).max(40),
  checkpoints: z.array(lessonReplyCheckpointSchema).max(60),
});
export type LessonReply = z.infer<typeof lessonReplySchema>;

// What is saved: marks carry exact character positions; sources are passage ids and labels.
export const lessonMarkSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  type: z.enum(MARK_TYPES),
  authority: z.string().max(60).optional(),
});
export type LessonMark = z.infer<typeof lessonMarkSchema>;

export const lessonSourceSchema = z.object({
  label: z.number().int().min(1),
  passageId: z.string(),
  title: z.string(),
  heading: z.string().nullable(),
  pages: z.string().nullable(),
});
export type LessonSource = z.infer<typeof lessonSourceSchema>;

export const lessonContentSchema = z.object({
  sections: z.array(
    z.object({
      heading: z.string(),
      paragraphs: z.array(
        z.object({
          text: z.string(),
          sources: z.array(z.number().int()),
          marks: z.array(lessonMarkSchema),
        }),
      ),
    }),
  ),
  sources: z.array(lessonSourceSchema),
});
export type LessonContent = z.infer<typeof lessonContentSchema>;

export const topicIdSchema = z.uuid({ error: "That topic could not be found." });
export const lessonIdSchema = z.uuid({ error: "That lesson could not be found." });
export const reviewNoteSchema = z.string().trim().max(2000, { error: "Notes can be up to 2,000 characters." });
