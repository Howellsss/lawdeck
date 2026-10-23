import { z } from "@/lib/zod";

// Report a problem (PRD FB-01) and takedown requests (PRD FB-03): Phase 6, step 6f.
export const REPORT_TARGETS = ["answer", "document", "brief", "practice_item"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_CATEGORIES = {
  wrong_law: "Wrong law",
  outdated: "Out of date",
  unclear: "Unclear",
  formatting: "Formatting",
  other: "Something else",
} as const;
export type ReportCategory = keyof typeof REPORT_CATEGORIES;

export const REPORT_NOTE_MAX = 500;

export const reportSchema = z.object({
  kind: z.enum(REPORT_TARGETS),
  id: z.uuid({ error: "That could not be found." }),
  category: z.enum(Object.keys(REPORT_CATEGORIES) as [ReportCategory, ...ReportCategory[]], { error: "Choose what is wrong." }),
  note: z
    .string()
    .trim()
    .max(REPORT_NOTE_MAX, { error: `Use ${REPORT_NOTE_MAX} characters or fewer.` })
    .transform((value) => value || null),
});
export type ReportInput = z.input<typeof reportSchema>;

const text = (label: string, max: number) =>
  z
    .string({ error: `Enter ${label}.` })
    .trim()
    .min(1, { error: `Enter ${label}.` })
    .max(max, { error: `Use ${max} characters or fewer.` });

export const takedownSchema = z.object({
  name: text("your name", 120),
  email: z.email({ error: "Enter a real email address." }).max(254, { error: "Use 254 characters or fewer." }),
  material: text("the material you want removed", 2000),
  reason: text("why it should be removed", 4000),
});
export type TakedownInput = z.infer<typeof takedownSchema>;

// Takedown requests are acted on within 7 days (PRD FB-03).
export const TAKEDOWN_DAYS = 7;
