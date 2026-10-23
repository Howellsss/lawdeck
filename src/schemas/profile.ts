import { z } from "@/lib/zod";

// "Your name" on the Account page (used only for the greeting).
export const NAME_MAX = 80;
export const ownNameSchema = z.object({
  name: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(NAME_MAX, { error: `Use ${NAME_MAX} characters or fewer.` })),
});
