import { z } from "zod";

// View-only share links (Phase 6, step 6d; PRD EX-04).
export const SHARE_KINDS = ["document", "project"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

// 64 random lowercase hexadecimal characters, made by the database.
export const shareTokenSchema = z.string().regex(/^[0-9a-f]{64}$/, { error: "That link is not valid." });
export const shareIdSchema = z.uuid({ error: "That link could not be found." });
export const createShareSchema = z.object({
  kind: z.enum(SHARE_KINDS),
  id: z.uuid({ error: "That could not be found." }),
});
export const sharedItemSchema = z.object({ token: shareTokenSchema, id: z.uuid({ error: "That could not be found." }) });
