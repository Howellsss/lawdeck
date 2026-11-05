import { z } from "@/lib/zod";

// Memory aids and stories (docs/specs/remembrance.md, Phase 2): what Claude returns, checked
// before anything is used.
export const AID_KINDS = ["acronym", "phrase", "association", "pattern"] as const;
export type AidKind = (typeof AID_KINDS)[number];
export const STORY_KINDS = ["everyday", "case"] as const;
export type StoryKind = (typeof STORY_KINDS)[number];

const sources = z.array(z.number().int().min(1).max(500)).max(40);

export const extrasReplySchema = z.object({
  found: z.boolean(),
  memory_aids: z
    .array(
      z.object({
        after_section: z.number().int().min(0).max(199),
        kind: z.enum(AID_KINDS),
        title: z.string().trim().min(2).max(200),
        device: z.string().trim().min(1).max(300),
        items: z.array(z.object({ key: z.string().trim().min(1).max(80), meaning: z.string().trim().min(1).max(400) })).max(20),
        explanation: z.string().trim().max(1500),
        sources,
      }),
    )
    .max(12),
  stories: z
    .array(
      z.object({
        after_section: z.number().int().min(0).max(199),
        kind: z.enum(STORY_KINDS),
        title: z.string().trim().min(2).max(200),
        authority: z.string().trim().max(60),
        parts: z.array(z.object({ heading: z.string().trim().min(1).max(120), text: z.string().trim().min(1).max(2500) })).min(1).max(12),
        takeaway: z.string().trim().min(1).max(400),
        question: z.string().trim().max(600),
        choices: z.array(z.string().trim().min(1).max(400)).max(6),
        correct_choice: z.number().int().min(-1).max(5),
        explanation: z.string().trim().max(1500),
        sources,
      }),
    )
    .max(8),
});
export type ExtrasReply = z.infer<typeof extrasReplySchema>;
