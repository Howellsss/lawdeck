import { z } from "zod";

// What can be exported as a study sheet (Phase 6, step 6e; PRD EX-03).
export const EXPORT_KINDS = ["chat", "brief", "practice"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export const exportRequestSchema = z.object({
  kind: z.enum(EXPORT_KINDS),
  id: z.uuid(),
  // Practice sets: only the cards not marked "know it" yet.
  notKnown: z.boolean().default(false),
});
export type ExportRequest = z.infer<typeof exportRequestSchema>;
