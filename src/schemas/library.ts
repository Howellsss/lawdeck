import { z } from "zod";
import { LIBRARY_FILE_TYPES, LIBRARY_MAX_BYTES } from "@/lib/libraryFiles";
import { KB_ITEM_TYPES } from "@/lib/libraryLabels";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max, { error: message }))
    .transform((value) => (value === "" ? null : value));

const thisYear = new Date().getUTCFullYear();

// The details entered with a library file (System Design: kb_items metadata, PRD KB-01).
export const libraryDetailsSchema = z.object({
  title: z
    .string({ error: "Enter a title." })
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, { error: "Enter a title." }).max(300, { error: "Use 300 characters or fewer." })),
  type: z.enum(Object.keys(KB_ITEM_TYPES) as [keyof typeof KB_ITEM_TYPES], { error: "Choose a type." }),
  courseId: z.uuid({ error: "Choose a course." }),
  campus: optionalText(80, "Use 80 characters or fewer."),
  year: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(
      z
        .number({ error: "Enter a year like 2024." })
        .int({ error: "Enter a year like 2024." })
        .min(1960, { error: "Enter a year from 1960 onwards." })
        .max(thisYear + 1, { error: `Enter a year up to ${thisYear + 1}.` })
        .nullable(),
    ),
  source: optionalText(500, "Use 500 characters or fewer."),
});

export const libraryFileSchema = z.object({
  fileName: z.string().min(1).max(255, { error: "The file name is too long. Rename it and try again." }),
  size: z
    .number()
    .int()
    .positive({ error: "That file is empty." })
    .max(LIBRARY_MAX_BYTES, { error: "Files must be 25 MB or smaller." }),
  kind: z.enum(Object.keys(LIBRARY_FILE_TYPES) as [keyof typeof LIBRARY_FILE_TYPES], {
    error: "Upload a PDF, Word (DOCX), PNG or JPEG file.",
  }),
});

export const libraryItemIdSchema = z.uuid({ error: "That item could not be found." });
// Where a file is stored: course id / item id . extension (set by the server, checked again on finish).
export const libraryPathSchema = z
  .string()
  .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|docx|png|jpeg)$/, { error: "Upload not recognised." });
