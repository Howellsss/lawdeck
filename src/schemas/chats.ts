import { z } from "@/lib/zod";

// The database allows titles of 1 to 200 characters (migration 2).
export const CHAT_TITLE_MAX = 200;

export const chatIdSchema = z.uuid({ error: "That chat could not be found." });

export const chatTitleSchema = z
  .string({ error: "Enter a name for the chat." })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, { error: "Enter a name for the chat." })
      .max(CHAT_TITLE_MAX, { error: `Use ${CHAT_TITLE_MAX} characters or fewer.` }),
  );

export const renameChatSchema = z.object({ id: chatIdSchema, title: chatTitleSchema });
export const deleteChatSchema = z.object({ id: chatIdSchema });
// An empty project means "no project": the chat goes back to Recents only.
export const moveChatSchema = z.object({
  id: chatIdSchema,
  projectId: z
    .union([z.literal(""), z.uuid({ error: "Choose a project from the list." })])
    .transform((value) => (value === "" ? null : value)),
});
