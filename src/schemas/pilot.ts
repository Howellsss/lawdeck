import { z } from "@/lib/zod";

// The closed pilot (Phase 8, migration 32).

// Invite codes: 10 characters from letters and digits that are easy to read (no I, L, O, 0 or 1).
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const inviteCodeSchema = z
  .string({ error: "Enter your invite code." })
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/, { error: "Invite codes are 10 letters and numbers, like K7MPQ2RXTA." }));

export const newInviteSchema = z.object({
  label: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, { error: "Name the group, for example “Resit group A”." }).max(80, { error: "Use 80 characters or fewer." })),
  maxUses: z.coerce.number({ error: "Enter how many students can use it." }).int().min(1, { error: "At least 1." }).max(500, { error: "At most 500." }),
  // Days until the code stops working; empty for no end date.
  expiresInDays: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(z.number({ error: "Enter a number of days." }).int().min(1, { error: "At least 1 day." }).max(90, { error: "At most 90 days." }).nullable()),
});

export const pilotSettingsSchema = z
  .object({
    inviteOnly: z.boolean(),
    priceQuestionOpen: z.boolean(),
    priceNgn: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : Number(value.replace(/[,₦\s]/g, ""))))
      .pipe(z.number({ error: "Enter the monthly price in naira." }).int().min(100, { error: "At least ₦100." }).max(1000000, { error: "At most ₦1,000,000." }).nullable()),
  })
  .refine((value) => !value.priceQuestionOpen || value.priceNgn !== null, { error: "Set a price before opening the question.", path: ["priceNgn"] });

export const PRICE_ANSWERS = { yes: "Yes", maybe: "Maybe", no: "No" } as const;
export const priceAnswerSchema = z.enum(["yes", "maybe", "no"]);
export const inviteIdSchema = z.uuid();

// Giving or removing someone's access from the Users page (migration 35).
export const pilotAccessSchema = z.object({ person: z.uuid(), allow: z.boolean() });

// Limits for a public test (migration 35). Each box may be left empty for "no extra limit".
function optionalWhole(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(
      z
        .number({ error: `Enter ${label} as a number, or leave it empty.` })
        .int({ error: "Use a whole number." })
        .min(min, { error: `At least ${min}.` })
        .max(max, { error: `At most ${max}.` })
        .nullable(),
    );
}

export const usageLimitsSchema = z
  .object({
    burstLimit: optionalWhole("the questions", 1, 100),
    burstHours: optionalWhole("the hours", 1, 24),
    monthlyQuestionCap: optionalWhole("the questions a month", 1, 1000),
    monthlyScanPageCap: optionalWhole("the scanned pages", 0, 1000),
  })
  .refine((value) => (value.burstLimit === null) === (value.burstHours === null), {
    error: "Fill in both boxes, or leave both empty.",
    path: ["burstHours"],
  });

// Registered emails (migration 36): one or more emails, separated by commas, spaces or new lines,
// up to 50 at a time. Tidied to lower case, without repeats.
export const REGISTER_EMAILS_MAX = 50;
export const registerEmailsSchema = z
  .string()
  .transform((value) => [...new Set(value.split(/[\s,;]+/).map((part) => part.trim().toLowerCase()).filter(Boolean))])
  .superRefine((emails, ctx) => {
    if (emails.length === 0) ctx.addIssue({ code: "custom", message: "Type at least one email." });
    if (emails.length > REGISTER_EMAILS_MAX) ctx.addIssue({ code: "custom", message: `Add at most ${REGISTER_EMAILS_MAX} emails at a time.` });
    const wrong = emails.find((email) => !z.email().max(254).safeParse(email).success);
    if (wrong) ctx.addIssue({ code: "custom", message: `“${wrong.slice(0, 60)}” is not an email address.` });
  });
export const pilotEmailIdSchema = z.uuid();
