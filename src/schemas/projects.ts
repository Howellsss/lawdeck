import { z } from "zod";

export const PROJECT_NAME_MAX = 120;

export const projectIdSchema = z.uuid({ error: "That project could not be found." });

export const projectNameSchema = z
  .string({ error: "Enter a name for the project." })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, { error: "Enter a name for the project." })
      .max(PROJECT_NAME_MAX, { error: `Use ${PROJECT_NAME_MAX} characters or fewer.` }),
  );

export const createProjectSchema = z.object({ name: projectNameSchema });
export const renameProjectSchema = z.object({ id: projectIdSchema, name: projectNameSchema });
export const deleteProjectSchema = z.object({ id: projectIdSchema });
