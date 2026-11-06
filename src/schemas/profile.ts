import { z } from "@/lib/zod";

// "Your name" on the Account page (used only for the greeting).
export const NAME_MAX = 80;
export const ownNameSchema = z.object({
  name: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(NAME_MAX, { error: `Use ${NAME_MAX} characters or fewer.` })),
});

// "Your campus" (campus chat, Phase 1): a key from the campuses table, or empty to clear it. The
// database checks the key is on the list.
export const campusSchema = z.object({
  campus: z
    .string()
    .trim()
    .regex(/^([a-z][a-z-]{1,39})?$/, { error: "Choose a campus from the list." }),
});
